"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = exports.EventTypes = void 0;
const node_events_1 = require("node:events");
exports.EventTypes = {
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    TENANT_CREATED: 'tenant.created',
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    COMMISSION_CALCULATED: 'commission.calculated',
    AGENT_EXECUTED: 'agent.executed',
    STOREFRONT_CREATED: 'storefront.created',
};
class EventBus {
    emitter = new node_events_1.EventEmitter();
    on(event, handler) {
        this.emitter.on(event, handler);
    }
    emit(event) {
        this.emitter.emit(event.type, event);
    }
    off(event, handler) {
        this.emitter.off(event, handler);
    }
}
exports.EventBus = EventBus;
