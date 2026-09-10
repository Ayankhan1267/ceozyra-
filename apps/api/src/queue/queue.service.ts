/**
 * ZYRA — Queue Service
 * In-memory job queue with BullMQ-ready interface.
 * Swap to BullMQ when Redis workers are deployed.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';

interface Job {
  id: string;
  name: string;
  data: Record<string, unknown>;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  attempts: number;
  createdAt: Date;
  processedOn?: Date;
  finishedOn?: Date;
}

type QueueName = 'emails' | 'sms' | 'whatsapp' | 'ai-jobs' | 'analytics';

@Injectable()
export class QueueService implements OnModuleInit {
  private queues: Record<QueueName, Job[]> = {
    emails: [],
    sms: [],
    whatsapp: [],
    'ai-jobs': [],
    analytics: [],
  };
  private jobIdCounter = 0;

  onModuleInit() {
    // Process jobs in background
    this.processJobs();
  }

  private async processJobs() {
    for (const queueName of Object.keys(this.queues) as QueueName[]) {
      const job = this.queues[queueName].find((j) => j.status === 'waiting');
      if (job) {
        job.status = 'active';
        job.processedOn = new Date();
        try {
          job.result = { success: true, message: 'Processed in-memory' };
          job.status = 'completed';
          job.finishedOn = new Date();
        } catch (error) {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : 'Unknown error';
          job.finishedOn = new Date();
        }
      }
    }
    setTimeout(() => this.processJobs(), 5000);
  }

  async addJob(queueName: QueueName, name: string, data: Record<string, unknown>, options?: { attempts?: number }): Promise<Job> {
    const job: Job = {
      id: `job_${++this.jobIdCounter}`,
      name,
      data,
      status: 'waiting',
      attempts: options?.attempts || 1,
      createdAt: new Date(),
    };
    this.queues[queueName].push(job);
    return job;
  }

  async getJobStatus(queueName: QueueName, jobId: string) {
    const queue = this.queues[queueName];
    const job = queue.find((j) => j.id === jobId);
    if (!job) return null;
    return {
      id: job.id,
      name: job.name,
      state: job.status,
      progress: job.status === 'completed' ? 100 : job.status === 'failed' ? 0 : 50,
      failedReason: job.error,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };
  }

  async addEmailJob(name: string, data: Record<string, unknown>) {
    return this.addJob('emails', name, data, { attempts: 3 });
  }

  async addSmsJob(name: string, data: Record<string, unknown>) {
    return this.addJob('sms', name, data, { attempts: 3 });
  }

  async addWhatsAppJob(name: string, data: Record<string, unknown>) {
    return this.addJob('whatsapp', name, data, { attempts: 3 });
  }

  async addAiJob(name: string, data: Record<string, unknown>) {
    return this.addJob('ai-jobs', name, data, { attempts: 2 });
  }

  async addAnalyticsJob(name: string, data: Record<string, unknown>) {
    return this.addJob('analytics', name, data, { attempts: 3 });
  }

  getQueueStats() {
    const stats: Record<QueueName, { waiting: number; active: number; completed: number; failed: number }> = {
      emails: { waiting: 0, active: 0, completed: 0, failed: 0 },
      sms: { waiting: 0, active: 0, completed: 0, failed: 0 },
      whatsapp: { waiting: 0, active: 0, completed: 0, failed: 0 },
      'ai-jobs': { waiting: 0, active: 0, completed: 0, failed: 0 },
      analytics: { waiting: 0, active: 0, completed: 0, failed: 0 },
    };

    for (const [name, jobs] of Object.entries(this.queues)) {
      const q = name as QueueName;
      for (const job of jobs) {
        stats[q][job.status]++;
      }
    }

    return stats;
  }
}
