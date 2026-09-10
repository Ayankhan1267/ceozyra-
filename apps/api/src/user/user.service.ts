/**
 * ZYRA — User Service
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { type Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  tenantId: string;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByEmail(email: string, tenantId?: string) {
    return this.prisma.user.findFirst({
      where: { email, ...(tenantId ? { tenantId } : {}) },
    });
  }

  async findByTenant(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          emailVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { tenantId } }),
    ]);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(dto: CreateUserDto) {
    const { password, ...rest } = dto;
    return this.prisma.user.create({
      data: { ...rest, password },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        emailVerified: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        emailVerified: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async updateRole(id: string, role: Role | string) {
    return this.prisma.user.update({
      where: { id },
      data: { role: role as Role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        emailVerified: true,
      },
    });
  }
}
