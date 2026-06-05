import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AuthService } from './auth.service';
import {
  AcceptInvitationDto,
  CompleteOnboardingDto,
  ForgotPasswordDto,
  InviteMemberDto,
  LoginDto,
  OnboardingAnswerDto,
  RegisterDto,
  ResetPasswordDto,
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

  @Post('auth/verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post('auth/reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
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
}
