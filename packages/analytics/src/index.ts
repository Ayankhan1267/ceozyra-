import type { TenantId, UserId } from '@zyra/types';
export interface AnalyticsEvent {
  name: string;
  properties: Record<string, unknown>;
  userId?: UserId;
  tenantId?: TenantId;
  timestamp: Date;
}
const events: AnalyticsEvent[] = [];
export function trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): void {
  events.push({ ...event, timestamp: new Date() });
}
export function getEvents(): AnalyticsEvent[] {
  return [...events];
}
