import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CreateSupportTicketDto, ReplySupportTicketDto } from './dto';
import { SupportService } from './support.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('support/tickets')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateSupportTicketDto) {
    return this.support.create(user.sub, dto);
  }

  @Get('support/tickets')
  mine(@CurrentUser() user: JwtUser) {
    return this.support.mine(user.sub);
  }

  @Get('admin/support/tickets')
  all(@CurrentUser() user: JwtUser) {
    return this.support.all(user);
  }

  @Patch('admin/support/tickets/:id/reply')
  reply(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReplySupportTicketDto,
  ) {
    return this.support.reply(user, id, dto);
  }
}
