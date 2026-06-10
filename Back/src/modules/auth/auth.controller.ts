import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AuthService } from './auth.service';
import {
  AcceptInvitationDto,
  CompleteOnboardingDto,
  CompleteInvitationDto,
  CreateOrganizationDto,
  ForgotPasswordDto,
  InviteMemberDto,
  LoginDto,
  OnboardingAnswerDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  UpdateOrganizationDto,
  VerifyOtpDto,
} from './dto';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('auth/forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Post('auth/resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.auth.resendOtp(dto);
  }

  @Post('auth/verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post('auth/reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Get('auth/invitations/:token')
  invitation(@Param('token') token: string) {
    return this.auth.invitation(token);
  }

  @Post('auth/complete-invitation')
  completeInvitation(@Body() dto: CompleteInvitationDto) {
    return this.auth.completeInvitation(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('onboarding/:organizationId/next')
  nextQuestion(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.auth.getNextOnboardingQuestion(organizationId, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/:organizationId/answer')
  answer(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: OnboardingAnswerDto,
  ) {
    return this.auth.answerOnboarding(organizationId, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/complete')
  completeNewOrganization(
    @CurrentUser() user: JwtUser,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.auth.completeOnboarding(undefined, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('onboarding/:organizationId/complete')
  completeOnboarding(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CompleteOnboardingDto,
  ) {
    return this.auth.completeOnboarding(organizationId, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('org/:organizationId/invitations')
  invite(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.auth.inviteMember(organizationId, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('auth/accept-invitation')
  accept(@CurrentUser() user: JwtUser, @Body() dto: AcceptInvitationDto) {
    return this.auth.acceptInvitation(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('organizations')
  createOrganization(@CurrentUser() user: JwtUser, @Body() dto: CreateOrganizationDto) {
    return this.auth.createOrganization(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('org/:organizationId/access')
  access(@Param('organizationId') organizationId: string, @CurrentUser() user: JwtUser) {
    return this.auth.organizationAccess(organizationId, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('org/:organizationId/members')
  members(@Param('organizationId') organizationId: string, @CurrentUser() user: JwtUser) {
    return this.auth.members(organizationId, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('org/:organizationId/members/:memberId')
  removeMember(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.auth.removeMember(organizationId, memberId, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('org/:organizationId')
  updateOrganization(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.auth.updateOrganization(organizationId, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('org/:organizationId')
  deleteOrganization(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.auth.deleteOrganization(organizationId, user.sub);
  }
}
