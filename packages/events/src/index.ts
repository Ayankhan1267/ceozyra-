import { EventEmitter } from 'node:events';
export const EventTypes = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  TENANT_CREATED: 'tenant.created',
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  COMMISSION_CALCULATED: 'commission.calculated',
  AGENT_EXECUTED: 'agent.executed',
  STOREFRONT_CREATED: 'storefront.created',
} as const;
export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
export interface ZyraEvent<T = Record<string, unknown>> {
  id: string;
  type: EventType;
  payload: T;
  tenantId: string;
  createdAt: Date;
}
export class EventBus {
  private emitter = new EventEmitter();
  on(event: EventType, handler: (e: ZyraEvent) => void): void {
    this.emitter.on(event, handler);
  }
  emit(event: ZyraEvent): void {
    this.emitter.emit(event.type, event);
  }
  off(event: EventType, handler: (e: ZyraEvent) => void): void {
    this.emitter.off(event, handler);
  }
}
