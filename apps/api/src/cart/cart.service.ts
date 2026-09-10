/**
 * ZYRA — Cart Service
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma, CartItem, Product, ProductVariant } from '@prisma/client';

export interface CreateCartDto {
  tenantId: string;
  storefrontId: string;
  customerId?: string;
  sessionId?: string;
}

export interface AddCartItemDto {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface UpdateCartItemDto {
  quantity: number;
}

export interface CartWithItems extends Prisma.CartGetPayload<{
  include: {
    items: {
      include: {
        product: { include: { variants: true } };
        variant: true;
      };
    };
    customer: true;
  };
}> {}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySessionId(sessionId: string): Promise<CartWithItems | null> {
    const cart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: {
        items: {
          include: {
            product: { include: { variants: true } },
            variant: true,
          },
        },
        customer: true,
      },
    });
    return cart;
  }

  async findByCustomerId(customerId: string): Promise<CartWithItems | null> {
    const cart = await this.prisma.cart.findFirst({
      where: { customerId },
      include: {
        items: {
          include: {
            product: { include: { variants: true } },
            variant: true,
          },
        },
        customer: true,
      },
    });
    return cart;
  }

  async findById(id: string): Promise<CartWithItems | null> {
    return this.prisma.cart.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { include: { variants: true } },
            variant: true,
          },
        },
        customer: true,
      },
    });
  }

  async createOrGet(dto: CreateCartDto): Promise<CartWithItems> {
    // If sessionId provided, try to find existing cart
    if (dto.sessionId) {
      const existing = await this.prisma.cart.findUnique({
        where: { sessionId: dto.sessionId },
      });
      if (existing) {
        return this.findById(existing.id) as Promise<CartWithItems>;
      }
    }

    // If customerId provided, check if they have an existing cart
    if (dto.customerId) {
      const existing = await this.prisma.cart.findFirst({
        where: { customerId: dto.customerId },
      });
      if (existing) {
        // Update sessionId if provided
        if (dto.sessionId) {
          await this.prisma.cart.update({
            where: { id: existing.id },
            data: { sessionId: dto.sessionId },
          });
        }
        return this.findById(existing.id) as Promise<CartWithItems>;
      }
    }

    // Create new cart
    return this.prisma.cart.create({
      data: {
        tenantId: dto.tenantId,
        storefrontId: dto.storefrontId,
        customerId: dto.customerId,
        sessionId: dto.sessionId,
      },
      include: {
        items: { include: { product: { include: { variants: true } }, variant: true } },
        customer: true,
      },
    });
  }

  async addItem(cartId: string, dto: AddCartItemDto): Promise<CartWithItems> {
    // Validate product exists and is active
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (!product.isActive) {
      throw new BadRequestException('Product is not available');
    }

    // Validate variant if provided
    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId },
      });
      if (!variant) {
        throw new NotFoundException('Product variant not found');
      }
    }

    // Check if item already in cart
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        cartId,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
      },
    });

    if (existingItem) {
      // Update quantity
      const updated = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: { increment: dto.quantity } },
        include: {
          product: { include: { variants: true } },
          variant: true,
        },
      });
      // Update cart timestamp
      await this.prisma.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
      });
      return this.findById(cartId) as Promise<CartWithItems>;
    }

    // Get price
    const price = dto.variantId
      ? (await this.prisma.productVariant.findUnique({ where: { id: dto.variantId } }))?.price ?? product.price
      : product.price;

    // Create new cart item
    await this.prisma.cartItem.create({
      data: {
        cartId,
        productId: dto.productId,
        variantId: dto.variantId,
        quantity: dto.quantity,
        price: price as any,
      },
    });

    // Update cart timestamp
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });

    return this.findById(cartId) as Promise<CartWithItems>;
  }

  async updateItem(cartId: string, itemId: string, dto: UpdateCartItemDto): Promise<CartWithItems> {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.cartId !== cartId) {
      throw new NotFoundException('Cart item not found');
    }

    if (dto.quantity <= 0) {
      await this.removeItem(cartId, itemId);
      return this.findById(cartId) as Promise<CartWithItems>;
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });

    return this.findById(cartId) as Promise<CartWithItems>;
  }

  async removeItem(cartId: string, itemId: string): Promise<CartWithItems> {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.cartId !== cartId) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });

    return this.findById(cartId) as Promise<CartWithItems>;
  }

  async clear(cartId: string): Promise<CartWithItems> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId },
    });

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { updatedAt: new Date() },
    });

    return this.findById(cartId) as Promise<CartWithItems>;
  }

  async delete(cartId: string): Promise<void> {
    await this.prisma.cart.delete({
      where: { id: cartId },
    });
  }

  getCartSummary(cart: CartWithItems) {
    const items = cart.items.map((item) => ({
      id: item.id,
      productId: item.product.id,
      productName: item.product.name,
      variantId: item.variantId,
      variantName: item.variant?.name,
      image: item.product.images?.[0],
      price: Number(item.price),
      quantity: item.quantity,
      lineTotal: Number(item.price) * item.quantity,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    return {
      id: cart.id,
      tenantId: cart.tenantId,
      storefrontId: cart.storefrontId,
      customerId: cart.customerId,
      sessionId: cart.sessionId,
      items,
      subtotal,
      itemCount: items.length,
    };
  }
}
