/**
 * ZYRA — Customer Preferences & Consent Service
 * Handles customer preferences, consent management, and GDPR data export.
 * Preferences are stored in the Customer.metadata JSON field.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CustomerPreferences {
  notificationChannels: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    push: boolean;
  };
  marketingOptIn: boolean;
  dataProcessingConsent: boolean;
  language: string;
  timezone: string;
  updatedAt: string;
}

export interface ConsentRecord {
  type: string;
  granted: boolean;
  timestamp: string;
  source: string;
  ipAddress?: string;
}

export interface PreferencesUpdateDto {
  notificationChannels?: Partial<CustomerPreferences['notificationChannels']>;
  marketingOptIn?: boolean;
  dataProcessingConsent?: boolean;
  language?: string;
  timezone?: string;
}

export interface ConsentRecordDto {
  type: string;
  granted: boolean;
  source?: string;
  ipAddress?: string;
}

const DEFAULT_PREFERENCES: CustomerPreferences = {
  notificationChannels: { email: true, sms: false, whatsapp: false, push: true },
  marketingOptIn: true,
  dataProcessingConsent: true,
  language: 'en',
  timezone: 'UTC',
  updatedAt: new Date().toISOString(),
};

const CONSENT_TYPES = ['email', 'sms', 'whatsapp', 'data_processing', 'marketing', 'cookies'];

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CustomerPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Read preferences from customer.metadata, falling back to defaults. */
  async getPreferences(customerId: string): Promise<CustomerPreferences> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { metadata: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const stored = (customer.metadata as Record<string, unknown> | null)?.preferences as
      | Partial<CustomerPreferences>
      | undefined;

    return {
      ...DEFAULT_PREFERENCES,
      ...stored,
      notificationChannels: {
        ...DEFAULT_PREFERENCES.notificationChannels,
        ...(stored?.notificationChannels as Record<string, boolean> | undefined),
      },
      updatedAt: stored?.updatedAt || new Date().toISOString(),
    };
  }

  /** Write preferences back into customer.metadata. */
  async updatePreferences(customerId: string, dto: PreferencesUpdateDto): Promise<CustomerPreferences> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { metadata: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const existing = (customer.metadata as Record<string, unknown> | null) || {};
    const currentPrefs = (existing.preferences as Partial<CustomerPreferences>) || {};

    const updatedPrefs: CustomerPreferences = {
      ...currentPrefs,
      ...dto,
      notificationChannels: {
        ...(currentPrefs.notificationChannels as Record<string, boolean> | undefined || DEFAULT_PREFERENCES.notificationChannels),
        ...(dto.notificationChannels as Record<string, boolean> | undefined || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    const newMetadata = { ...existing, preferences: updatedPrefs };

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { metadata: newMetadata },
    });

    return updatedPrefs;
  }

  /** Get consent history for a customer. */
  async getConsent(customerId: string): Promise<ConsentRecord[]> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { metadata: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const stored = (customer.metadata as Record<string, unknown> | null) || {};
    const history = (stored.consentHistory as ConsentRecord[] | undefined) || [];

    // Build default entries for any missing consent types
    const defaults: ConsentRecord[] = CONSENT_TYPES.map((type) => ({
      type,
      granted: true,
      timestamp: new Date().toISOString(),
      source: 'system_default',
    }));

    const historyByType = new Map(history.map((c) => [c.type, c]));
    return CONSENT_TYPES.map((type) => historyByType.get(type) || defaults.find((d) => d.type === type)!);
  }

  /** Record a consent event (opt-in or opt-out). */
  async recordConsent(
    customerId: string,
    dto: ConsentRecordDto,
  ): Promise<ConsentRecord> {
    if (!CONSENT_TYPES.includes(dto.type)) {
      throw new BadRequestException(
        `Invalid consent type. Allowed: ${CONSENT_TYPES.join(', ')}`,
      );
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { metadata: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const stored = (customer.metadata as Record<string, unknown> | null) || {};
    const history = (stored.consentHistory as ConsentRecord[] | undefined) || [];

    const record: ConsentRecord = {
      type: dto.type,
      granted: dto.granted,
      timestamp: new Date().toISOString(),
      source: dto.source || 'admin',
      ipAddress: dto.ipAddress,
    };

    const newHistory = [record, ...history].slice(0, 100); // cap at 100 entries

    const newMetadata = { ...stored, consentHistory: newHistory };

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { metadata: newMetadata },
    });

    return record;
  }

  /** GDPR Article 20 — data portability export. */
  async exportCustomerData(customerId: string): Promise<Record<string, unknown>> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customer },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        tags: true,
        segment: true,
        source: true,
        notes: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            subtotal: true,
            tax: true,
            shipping: true,
            discount: true,
            total: true,
            currency: true,
            createdAt: true,
            items: {
              select: {
                id: true,
                productId: true,
                quantity: true,
                unitPrice: true,
                total: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        Deal: {
          select: {
            id: true,
            title: true,
            value: true,
            status: true,
            stageId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        Activity: {
          select: {
            id: true,
            type: true,
            subject: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        emailMessages: {
          select: {
            id: true,
            subject: true,
            status: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        smsMessages: {
          select: {
            id: true,
            body: true,
            status: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        whatsappMessages: {
          select: {
            id: true,
            body: true,
            status: true,
            sentAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    // Read preferences + consent from metadata
    const metadata = (customer.metadata as Record<string, unknown> | null) || {};
    const preferences = metadata.preferences as Record<string, unknown> | undefined;
    const consentHistory = metadata.consentHistory as ConsentRecord[] | undefined;

    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      format: 'GDPR Article 20 — Data Portability',
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || null,
        tags: customer.tags,
        segment: customer.segment,
        source: customer.source,
        notes: customer.notes,
        memberSince: customer.createdAt,
        lastUpdated: customer.updatedAt,
      },
      preferences: preferences || null,
      consentHistory: consentHistory || null,
      orders: customer.orders,
      deals: customer.Deal,
      activities: customer.Activity,
      communications: {
        emails: customer.emailMessages,
        sms: customer.smsMessages,
        whatsapp: customer.whatsappMessages,
      },
    };

    return exportData;
  }
}
