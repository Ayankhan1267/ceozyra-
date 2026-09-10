/**
 * ZYRA — Queue Definitions (Phase 0.3)
 * BullMQ queue configuration for all business queues.
 *
 * BullMQ v5 requires an ioredis instance for the `connection` option.
 * Each queue entry exports: name, defaultJobOptions, and a Queue factory.
 */

import { Queue } from 'bullmq';
import { type Redis as IORedis } from 'ioredis';

/**
 * Shape of a single queue definition.
 */
export interface QueueDefinition {
  /** BullMQ queue name (used as Redis key prefix) */
  readonly name: string;
  /** Default options applied to every job added to this queue */
  readonly defaultJobOptions: {
    readonly attempts: number;
    readonly backoff: {
      readonly type: 'exponential';
      readonly delay: number;
    };
    readonly removeOnComplete: number | boolean;
    readonly removeOnFail: number | boolean;
  };
  /** Create a BullMQ Queue instance bound to the given ioredis client */
  createQueue: (client: IORedis) => Queue;
}

/**
 * Local defaultJobOptions lookup indexed by queue name (avoids circular
 * reference on QUEUES[] inside makeQueueOptions).
 */
const defaultJobOptionsByQueue: Record<string, QueueDefinition['defaultJobOptions']> = {
  email: { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 }, removeOnComplete: 86400, removeOnFail: 604800 },
  sms:   { attempts: 3, backoff: { type: 'exponential' as const, delay: 10000 }, removeOnComplete: 86400, removeOnFail: 604800 },
  whatsapp: { attempts: 4, backoff: { type: 'exponential' as const, delay: 15000 }, removeOnComplete: 86400, removeOnFail: 604800 },
  'ai-jobs': { attempts: 2, backoff: { type: 'exponential' as const, delay: 30000 }, removeOnComplete: 3600, removeOnFail: 259200 },
  analytics: { attempts: 3, backoff: { type: 'exponential' as const, delay: 60000 }, removeOnComplete: 21600, removeOnFail: 259200 },
  webhook: { attempts: 5, backoff: { type: 'exponential' as const, delay: 2000 }, removeOnComplete: 3600, removeOnFail: 604800 },
};

/**
 * Build a BullMQ QueueOptions object for a given name and ioredis client.
 */
function makeQueueOptions(name: string, client: IORedis) {
  return { connection: client as any, defaultJobOptions: defaultJobOptionsByQueue[name] };
}

/**
 * ------------------------------------------------------------------
 *  EMAIL — transactional and notification emails
 * ------------------------------------------------------------------
 * Attempts   : 3   (initial + 2 retries)
 * Backoff    : exponential, starts at 5 s → 25 s → 125 s
 * TTL        : keep completed for 24 h, failed for 7 d
 */
export const EMAIL: QueueDefinition = {
  name: 'email',
  defaultJobOptions: defaultJobOptionsByQueue.email,
  createQueue: (client: IORedis) =>
    new Queue('email', makeQueueOptions('email', client)),
};

/**
 * ------------------------------------------------------------------
 *  SMS — text-message notifications
 * ------------------------------------------------------------------
 * Attempts   : 3
 * Backoff    : exponential, starts at 10 s
 * TTL        : keep completed for 24 h, failed for 7 d
 */
export const SMS: QueueDefinition = {
  name: 'sms',
  defaultJobOptions: defaultJobOptionsByQueue.sms,
  createQueue: (client: IORedis) =>
    new Queue('sms', makeQueueOptions('sms', client)),
};

/**
 * ------------------------------------------------------------------
 *  WHATSAPP — WhatsApp Business API messages
 * ------------------------------------------------------------------
 * Attempts   : 4  (templates / media uploads can fail transiently)
 * Backoff    : exponential, starts at 15 s
 * TTL        : keep completed for 24 h, failed for 7 d
 */
export const WHATSAPP: QueueDefinition = {
  name: 'whatsapp',
  defaultJobOptions: defaultJobOptionsByQueue.whatsapp,
  createQueue: (client: IORedis) =>
    new Queue('whatsapp', makeQueueOptions('whatsapp', client)),
};

/**
 * ------------------------------------------------------------------
 *  AI_JOBS — background AI processing (summaries, embeddings, etc.)
 * ------------------------------------------------------------------
 * Attempts   : 2  (AI jobs are idempotent but expensive to re-queue)
 * Backoff    : exponential, starts at 30 s (allow upstream to recover)
 * TTL        : keep completed for 1 h, failed for 3 d
 */
export const AI_JOBS: QueueDefinition = {
  name: 'ai-jobs',
  defaultJobOptions: defaultJobOptionsByQueue['ai-jobs'],
  createQueue: (client: IORedis) =>
    new Queue('ai-jobs', makeQueueOptions('ai-jobs', client)),
};

/**
 * ------------------------------------------------------------------
 *  ANALYTICS — event aggregation, report generation, metrics rollup
 * ------------------------------------------------------------------
 * Attempts   : 3
 * Backoff    : exponential, starts at 60 s (batch jobs tolerate delay)
 * TTL        : keep completed for 6 h, failed for 3 d
 */
export const ANALYTICS: QueueDefinition = {
  name: 'analytics',
  defaultJobOptions: defaultJobOptionsByQueue.analytics,
  createQueue: (client: IORedis) =>
    new Queue('analytics', makeQueueOptions('analytics', client)),
};

/**
 * ------------------------------------------------------------------
 *  WEBHOOK — outgoing webhook deliveries to third-party systems
 * ------------------------------------------------------------------
 * Attempts   : 5  (webhooks should be delivered reliably)
 * Backoff    : exponential, starts at 2 s → 4 s → 16 s → 256 s
 * TTL        : keep completed for 1 h, failed for 7 d
 */
export const WEBHOOK: QueueDefinition = {
  name: 'webhook',
  defaultJobOptions: defaultJobOptionsByQueue.webhook,
  createQueue: (client: IORedis) =>
    new Queue('webhook', makeQueueOptions('webhook', client)),
};

/**
 * All queue definitions in the order they are registered.
 * Array order matters: workers are started in this sequence on boot.
 */
export const QUEUE_DEFINITIONS: readonly QueueDefinition[] = [
  EMAIL,
  SMS,
  WHATSAPP,
  AI_JOBS,
  ANALYTICS,
  WEBHOOK,
];

/** Friendly names used in log messages and metrics. */
export const QUEUE_NAMES: readonly string[] = QUEUE_DEFINITIONS.map((q) => q.name);
