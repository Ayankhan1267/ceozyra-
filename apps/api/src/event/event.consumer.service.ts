/**
 * ZYRA — Event Consumer Service
 * Processes events from BullMQ queues
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

export type EventHandler = (payload: Record<string, unknown>) => Promise<void>;

const HANDLERS = new Map<string, EventHandler>();

export function OnEvent(eventName: string) {
  return function (target: any, key: string) {
    HANDLERS.set(`${target.constructor.name}.${key}`, (payload) => target[key](payload));
  };
}

@Injectable()
export class EventConsumerService implements OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onModuleInit() {
    const handlers: Record<string, EventHandler> = {
      'order.created': async (p) => console.log('[Event] Order created:', p),
      'order.updated': async (p) => console.log('[Event] Order updated:', p),
      'user.created': async (p) => console.log('[Event] User created:', p),
      'commission.calculated': async (p) => console.log('[Event] Commission calculated:', p),
      'agent.executed': async (p) => console.log('[Event] Agent executed:', p),
      'storefront.created': async (p) => console.log('[Event] Storefront created:', p),
    };

    for (const [event, handler] of Object.entries(handlers)) {
      HANDLERS.set(event, handler);
      console.log(`[Event] Registered handler: ${event}`);
    }
  }

  async processEvent(eventName: string, payload: Record<string, unknown>) {
    const handler = HANDLERS.get(eventName);
    if (handler) {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`[Event] Handler failed for ${eventName}:`, error);
        throw error;
      }
    }
  }
}
