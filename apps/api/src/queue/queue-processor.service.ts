/**
 * ZYRA — Queue Processor Service (Phase 0.3)
 *
 * Registers BullMQ workers for every business queue, handles job lifecycle
 * events (completed, failed, stalled), and manages the dead-letter flow.
 *
 * Worker functions are NOT implemented here — they delegate to the
 * appropriate service layer.  Unimplemented handlers log a warning so
 * missing wiring surfaces in production logs rather than silently dropping
 * jobs.
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger as NestLogger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import {
  QUEUE_DEFINITIONS,
  QUEUE_NAMES,
  type QueueDefinition,
} from './queues';

/**
 * Payload shape every job receives — standardised across all queues.
 */
export interface JobPayload<T = unknown> {
  /** What the job does (e.g. 'send-welcome', 'generate-embedding') */
  action: string;
  /** Job-specific data */
  data: T;
  /** Tenant that owns this job (for scoping and auditing) */
  tenantId?: string;
  /** User that triggered the job (optional) */
  userId?: string;
  /** ISO-8601 timestamp when the job was created */
  createdAt: string;
}

/**
 * Lifecycle event types emitted by BullMQ.
 */
export enum JobLifecycleEvent {
  Completed = 'completed',
  Failed = 'failed',
  Stalled = 'stalled',
  Error = 'error',
}

/**
 * Structured log entry for queue lifecycle events.
 */
export interface QueueLifecycleLog {
  event: JobLifecycleEvent;
  queue: string;
  jobId: string;
  action: string;
  attempts: number;
  tenantId?: string;
  userId?: string;
  error?: string;
  timestamp: string;
}

/**
 * Registry of worker handler functions.
 *
 * Each queue type registers its own handler map.  A handler returns a
 * Promise that resolves on success or rejects on failure.  Rejected jobs
 * are automatically retried by BullMQ per the queue's defaultJobOptions.
 */
export type JobHandler<T = unknown> = (job: Job<JobPayload<T>>) => Promise<unknown>;

/**
 * Map of action → handler for a given queue.
 */
export type HandlerRegistry = Record<string, JobHandler>;

/**
 * Top-level handler map keyed by queue name.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueueHandlers = Record<string, HandlerRegistry>;

/**
 * Wired handler maps from other NestJS services.
 *
 * The QueueProcessor reads these at runtime; services inject
 * QueueProcessor and call `registerHandlers(queueName, handlers)`.
 */
const registeredHandlers: QueueHandlers = {};

// ---------------------------------------------------------------------------
// Default (fallback) handlers — log a warning so ops can see unwired jobs.
// ---------------------------------------------------------------------------

const DEFAULT_HANDLERS: HandlerRegistry = {
  unknown: async (job: Job) => {
    const action = (job.data as JobPayload)?.action ?? 'unknown';
    NestLogger.warn(
      `[Queue] No handler wired for action "${action}" ` +
        `in queue "${job.queueName}" — job ${job.id} will be retried up to ${job.opts?.attempts ?? 3} times.`,
      'QueueProcessor',
    );
    // Throw so BullMQ treats this as a failure and retries.
    throw new Error(
      `No handler registered for action "${action}" in queue "${job.queueName}"`,
    );
  },
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class QueueProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new NestLogger(QueueProcessorService.name);

  /** BullMQ workers keyed by queue name. */
  private workers: Record<string, Worker> = {};

  constructor(private readonly redisService: RedisService) {}

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    this.logger.log('Registering BullMQ workers for all queues...');
    for (const def of QUEUE_DEFINITIONS) {
      this.startWorker(def);
    }
    this.logger.log(
      `Workers started for queues: ${QUEUE_NAMES.join(', ')}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    for (const [name, worker] of Object.entries(this.workers)) {
      await worker.close();
      this.logger.debug(`Worker for queue "${name}" closed.`);
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Register one or more action → handler mappings for a given queue.
   * Services should call this in their own `onModuleInit`.
   */
  registerHandlers(queueName: string, handlers: HandlerRegistry): void {
    registeredHandlers[queueName] = {
      ...(registeredHandlers[queueName] ?? {}),
      ...handlers,
    };
    this.logger.debug(
      `Registered ${Object.keys(handlers).length} handler(s) for queue "${queueName}".`,
    );
  }

  /**
   * Return a snapshot of currently-registered handler counts per queue.
   */
  getHandlerCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const queueName of QUEUE_NAMES) {
      counts[queueName] = Object.keys(registeredHandlers[queueName] ?? {}).length;
    }
    return counts;
  }

  // -----------------------------------------------------------------------
  // Worker management
  // -----------------------------------------------------------------------

  private startWorker(def: QueueDefinition): void {
    const { name } = def;

    // Cast connection to any to bypass the v5/v6 ioredis type mismatch in pnpm hoisting
    const worker = new Worker(
      name,
      async (job: Job) => this.handleJob(job, def),
      { connection: this.redisService.ioredis as any },
    );

    // --- lifecycle events -------------------------------------------------
    worker.on('completed', (job: Job, returnValue: unknown) => {
      this.emitLifecycleEvent(def.name, job, JobLifecycleEvent.Completed, undefined);
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
      const jobId = job?.id ?? 'unknown';
      const action = (job?.data as JobPayload)?.action ?? 'unknown';
      this.logger.error(
        `[Queue] Job ${jobId} (${action}) failed in "${name}" after ${job?.attemptsMade ?? '?'} attempts: ${err.message}`,
      );
      this.emitLifecycleEvent(
        def.name,
        job ?? ({ id: jobId, data: { action } as JobPayload } as Job),
        JobLifecycleEvent.Failed,
        undefined,
        err.message,
      );
    });

    worker.on('error', (err: Error) => {
      this.logger.error(`[Queue] Worker error for "${name}": ${err.message}`);
    });

    worker.on('stalled', (jobId: string) => {
      this.logger.warn(`[Queue] Stalled job detected in "${name}": ${jobId}`);
    });

    this.workers[name] = worker;
  }

  // -----------------------------------------------------------------------
  // Job dispatch
  // -----------------------------------------------------------------------

  /**
   * Route a job to the correct handler based on queue name + action.
   */
  private async handleJob(job: Job, def: QueueDefinition): Promise<unknown> {
    const data = job.data as JobPayload;
    const action = data.action ?? 'unknown';
    const handlers = registeredHandlers[def.name] ?? {};
    const handler = handlers[action] ?? DEFAULT_HANDLERS.unknown;

    this.logger.debug(
      `[Queue] Processing job ${job.id} (action="${action}") in "${def.name}" (attempt ${job.attemptsMade + 1})`,
    );

    try {
      const result = await handler(job);
      this.logger.debug(
        `[Queue] Job ${job.id} (${action}) completed in "${def.name}"`,
      );
      return result;
    } catch (err) {
      this.logger.error(
        `[Queue] Job ${job.id} (${action}) errored in "${def.name}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw err;
    }
  }

  // -----------------------------------------------------------------------
  // Lifecycle logging helper
  // -----------------------------------------------------------------------

  private emitLifecycleEvent(
    queueName: string,
    job: Job,
    event: JobLifecycleEvent,
    _returnValue?: unknown,
    error?: string,
    attempts?: number,
  ): void {
    const logEntry: QueueLifecycleLog = {
      event,
      queue: queueName,
      jobId: job.id ?? 'unknown',
      action: (job.data as JobPayload).action ?? 'unknown',
      attempts: attempts ?? job.attemptsMade ?? 0,
      tenantId: (job.data as JobPayload)?.tenantId,
      userId: (job.data as JobPayload)?.userId,
      error,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`[Queue:${queueName}:${event}] ${JSON.stringify(logEntry)}`);
  }
}
