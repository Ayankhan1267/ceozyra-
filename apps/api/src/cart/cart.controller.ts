/**
 * ZYRA — Cart Controller
 */

import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { CartService, type AddCartItemDto, type CreateCartDto, type UpdateCartItemDto } from './cart.service';

@Controller('carts')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get('session/:sessionId')
  getBySession(@Param('sessionId') sessionId: string) {
    return this.cartService.findBySessionId(sessionId);
  }

  @Get('customer/:customerId')
  getByCustomer(@Param('customerId') customerId: string) {
    return this.cartService.findByCustomerId(customerId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.cartService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateCartDto) {
    return this.cartService.createOrGet(dto);
  }

  @Post(':id/items')
  addItem(@Param('id') cartId: string, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(cartId, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(@Param('id') cartId: string, @Param('itemId') itemId: string, @Body() dto: UpdateCartItemDto) {
    return this.cartService.updateItem(cartId, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Param('id') cartId: string, @Param('itemId') itemId: string) {
    return this.cartService.removeItem(cartId, itemId);
  }

  @Delete(':id/clear')
  clear(@Param('id') cartId: string) {
    return this.cartService.clear(cartId);
  }

  @Delete(':id')
  delete(@Param('id') cartId: string) {
    return this.cartService.delete(cartId);
  }

  @Get(':id/summary')
  summary(@Param('id') cartId: string) {
    return this.cartService.findById(cartId).then((cart) => {
      if (!cart) return null;
      return this.cartService.getCartSummary(cart);
    });
  }
}
