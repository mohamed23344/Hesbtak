import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { CreateCheckoutDto, VerifySubscriptionDto } from './dto';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  plans() {
    return this.billing.plans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscriptions/current')
  current(
    @Headers('x-tenant-id') organizationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.billing.current(organizationId, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions/checkout')
  checkout(
    @Headers('x-tenant-id') organizationId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.billing.checkout(organizationId, user.sub, dto.planId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions/verify')
  verify(
    @Headers('x-tenant-id') organizationId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: VerifySubscriptionDto,
  ) {
    return this.billing.verify(organizationId, user.sub, dto.reference);
  }

  @Post('subscriptions/paymob/webhook')
  webhook(
    @Body() body: Record<string, unknown>,
    @Query('hmac') hmac?: string,
  ) {
    return this.billing.webhook(body, hmac);
  }

  @Get('subscriptions/paymob/return')
  async paymentReturn(
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
    const redirectUrl = await this.billing.paymentReturn(query);
    return response.redirect(redirectUrl);
  }
}
