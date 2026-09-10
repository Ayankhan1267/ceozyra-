/**
 * ZYRA — Event Bus Service
 * In-process event bus using Node EventEmitter
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export interface ZyraEvent<T = Record<string, unknown>> {
  id: string;
  type: string;
  payload: T;
  tenantId: string;
  createdAt: Date;
}

@Injectable()
export class EventBusService implements OnModuleInit {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  onModuleInit() {
    // Register event handlers
    this.emitter.on('order.created', (payload) => console.log('[Event] Order created:', payload));
    this.emitter.on('order.updated', (payload) => console.log('[Event] Order updated:', payload));
    this.emitter.on('user.created', (payload) => console.log('[Event] User created:', payload));
    this.emitter.on('commission.calculated', (payload) => console.log('[Event] Commission calculated:', payload));
    this.emitter.on('agent.executed', (payload) => console.log('[Event] Agent executed:', payload));
    this.emitter.on('storefront.created', (payload) => console.log('[Event] Storefront created:', payload));
  }

  emit(type: string, payload: Record<string, unknown>) {
    this.emitter.emit(type, payload);
  }

  on(type: string, handler: (payload: Record<string, unknown>) => void) {
    this.emitter.on(type, handler);
  }

  off(type: string, handler: (payload: Record<string, unknown>) => void) {
    this.emitter.off(type, handler);
  }
}
