/**
 * ZYRA — Campaigns Service (Phase 4 Communications)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';

export interface CampaignFilter {
  type?: string;
  status?: string;
  page: number;
  limit: number;
}

export interface CampaignStats {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalFailed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async list(tenantId: string, filter: CampaignFilter) {
    const where: Record<string, unknown> = {};
    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;

    const skip = (filter.page - 1) * filter.limit;
    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        skip,
        take: filter.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { campaigns, total, page: filter.page, limit: filter.limit, totalPages: Math.ceil(total / filter.limit) };
  }

  async findById(id: string, tenantId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async getStats(campaignId: string, tenantId: string): Promise<CampaignStats> {
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId }, select: { id: true, type: true } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (campaign.type === 'EMAIL') {
      return this.getEmailStats(campaignId);
    }
    if (campaign.type === 'SMS') {
      return this.getSmsStats(campaignId);
    }
    if (campaign.type === 'WHATSAPP') {
      return this.getWhatsAppStats(campaignId);
    }
    return { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0, totalFailed: 0, deliveryRate: 0, openRate: 0, clickRate: 0 };
  }

  private async getEmailStats(campaignId: string): Promise<CampaignStats> {
    const emailCampaign = await this.prisma.emailCampaign.findFirst({ where: { campaignId }, select: { id: true } });
    if (!emailCampaign) return { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0, totalFailed: 0, deliveryRate: 0, openRate: 0, clickRate: 0 };

    const [totalSent, totalDelivered, totalOpened, totalClicked, totalFailed] = await Promise.all([
      this.prisma.emailMessage.count({ where: { campaignId: emailCampaign.id, status: { not: 'PENDING' } } }),
      this.prisma.emailMessage.count({ where: { campaignId: emailCampaign.id, status: { in: ['SENT', 'DELIVERED', 'READ'] } } }),
      this.prisma.emailMessage.count({ where: { campaignId: emailCampaign.id, openedAt: { not: null } } }),
      this.prisma.emailMessage.count({ where: { campaignId: emailCampaign.id, clickedAt: { not: null } } }),
      this.prisma.emailMessage.count({ where: { campaignId: emailCampaign.id, status: 'FAILED' } }),
    ]);

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
    const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;

    return { totalSent, totalDelivered, totalOpened, totalClicked, totalFailed, deliveryRate, openRate, clickRate };
  }

  private async getSmsStats(campaignId: string): Promise<CampaignStats> {
    const smsCampaign = await this.prisma.sMSCampaign.findFirst({ where: { campaignId }, select: { id: true } });
    if (!smsCampaign) return { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0, totalFailed: 0, deliveryRate: 0, openRate: 0, clickRate: 0 };

    const [totalSent, totalDelivered, totalFailed] = await Promise.all([
      this.prisma.sMSMessage.count({ where: { campaignId: smsCampaign.id } }),
      this.prisma.sMSMessage.count({ where: { campaignId: smsCampaign.id, status: { in: ['SENT', 'DELIVERED', 'READ'] } } }),
      this.prisma.sMSMessage.count({ where: { campaignId: smsCampaign.id, status: 'FAILED' } }),
    ]);

    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

    return { totalSent, totalDelivered, totalOpened: 0, totalClicked: 0, totalFailed, deliveryRate, openRate: 0, clickRate: 0 };
  }

  private async getWhatsAppStats(campaignId: string): Promise<CampaignStats> {
    // WhatsAppConversation doesn't have a direct campaignId link
    // Return zeroed stats for WhatsApp in campaign context
    return { totalSent: 0, totalDelivered: 0, totalOpened: 0, totalClicked: 0, totalFailed: 0, deliveryRate: 0, openRate: 0, clickRate: 0 };
  }

  async create(tenantId: string, data: Record<string, unknown>) {
    const campaign = await this.prisma.campaign.create({
      data: { ...data, tenantId } as any,
    });
    this.eventBus.emit('campaign.created', { campaignId: campaign.id, tenantId });
    return campaign;
  }

  async update(id: string, tenantId: string, data: Record<string, unknown>) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const updated = await this.prisma.campaign.update({ where: { id }, data });
    this.eventBus.emit('campaign.updated', { campaignId: id, tenantId });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    await this.prisma.campaign.delete({ where: { id } });
    this.eventBus.emit('campaign.deleted', { campaignId: id, tenantId });
    return { success: true };
  }

  async start(id: string, tenantId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId }, select: { id: true, status: true } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'ACTIVE' as any, startAt: new Date() },
    });

    this.eventBus.emit('campaign.started', { campaignId: id, tenantId });
    return updated;
  }

  async pause(id: string, tenantId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'PAUSED' as any },
    });

    this.eventBus.emit('campaign.paused', { campaignId: id, tenantId });
    return updated;
  }

  async complete(id: string, tenantId: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'COMPLETED' as any, endAt: new Date() },
    });

    this.eventBus.emit('campaign.completed', { campaignId: id, tenantId });
    return updated;
  }
}
