/**
 * ZYRA — Prisma Service
 * Wraps @prisma/client with tenant isolation middleware and lifecycle hooks.
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Scope } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getCurrentTenantId } from '../tenant/tenant.context';

@Injectable({ scope: Scope.DEFAULT })
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();

    // ── Tenant Isolation Middleware ─────────────────────────────
    // Auto-scopes queries by tenantId for models that carry it.
    // Only activates when a tenantId is present in the async context.
    this.$use(async (params, next) => {
      const tenantId = getCurrentTenantId();
      if (!tenantId) return next(params);

      // Models that have a tenantId column and need automatic scoping
      const TENANT_MODELS: Record<string, string> = {
        user: 'tenantId',
        order: 'tenantId',
        product: 'tenantId',
        customer: 'tenantId',
        commission: 'tenantId',
        agent: 'tenantId',
        agentRun: 'tenantId',
        agentTask: 'tenantId',
        agentDecision: 'tenantId',
        tool: 'tenantId',
        toolExecution: 'tenantId',
        campaign: 'tenantId',
        audience: 'tenantId',
        creative: 'tenantId',
        ad: 'tenantId',
        emailCampaign: 'tenantId',
        emailMessage: 'tenantId',
        smsCampaign: 'tenantId',
        smsMessage: 'tenantId',
        whatsappConversation: 'tenantId',
        whatsappMessage: 'tenantId',
        workflow: 'tenantId',
        workflowRun: 'tenantId',
        approval: 'tenantId',
        revenue: 'tenantId',
        expense: 'tenantId',
        invoice: 'tenantId',
        experiment: 'tenantId',
        review: 'tenantId',
        wishlistItem: 'tenantId',
        integration: 'tenantId',
        oauthConnection: 'tenantId',
        webhook: 'tenantId',
        subscription: 'tenantId',
        entitlement: 'tenantId',
        usageRecord: 'tenantId',
        billingEvent: 'tenantId',
        domain: 'tenantId',
        storeDomain: 'tenantId',
        notification: 'tenantId',
        inventoryItem: 'tenantId',
        supplier: 'tenantId',
        purchaseOrder: 'tenantId',
        lowStockAlert: 'tenantId',
        store: 'tenantId',
        auditLog: 'tenantId',
        lead: 'tenantId',
        company: 'tenantId',
        segment: 'tenantId',
        conversation: 'tenantId',
        message: 'tenantId',
        orderItem: 'tenantId',
        payment: 'tenantId',
        refund: 'tenantId',
        shipment: 'tenantId',
        inventoryMovement: 'tenantId',
        businessGoal: 'tenantId',
        businessPolicy: 'tenantId',
        businessMemory: 'tenantId',
        businessDecision: 'tenantId',
        businessEvent: 'tenantId',
        headAssignment: 'tenantId',
        partnerAssignment: 'tenantId',
        activity: 'tenantId',
        pipeline: 'tenantId',
        deal: 'tenantId',
        tag: 'tenantId',
    template: 'tenantId',
    automationRule: 'tenantId',
      };

      const tenantField = TENANT_MODELS[params.model ?? ''];
      if (!tenantField) return next(params);

      const args = (params.args ?? {}) as Record<string, unknown>;

      // For read operations, inject tenantId into the where clause
      if (['findMany', 'findFirst', 'findUnique', 'count', 'groupBy'].includes(params.action)) {
        const where = (args.where as Record<string, unknown>) ?? {};
        (args as Record<string, unknown>).where = { ...where, [tenantField]: tenantId };
        (params.args as unknown as Record<string, unknown>) = args;
      }

      return next(params);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
