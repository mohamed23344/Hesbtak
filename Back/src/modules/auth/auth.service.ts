import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import * as tls from 'node:tls';
import { DataBaseService } from '../../database/database.service';
import { TenantService } from '../tenant/tenant.service';
import {
  AcceptInvitationDto,
  CompleteOnboardingDto,
  CompleteInvitationDto,
  CreateOrganizationDto,
  ForgotPasswordDto,
  GoogleAuthDto,
  InviteMemberDto,
  LoginDto,
  OnboardingAnswerDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  UpdateOrganizationDto,
  UpdateMemberDto,
  VerifyOtpDto,
} from './dto';

@Injectable()
export class AuthService {
  private readonly onboardingQuestions = [
    { key: 'business_model', question: 'What does the business sell?' },
    { key: 'payment_methods', question: 'Which payment methods do you use?' },
    { key: 'main_expenses', question: 'What are the main expense categories?' },
  ];

  constructor(
    private readonly db: DataBaseService,
    private readonly jwt: JwtService,
    private readonly tenant: TenantService,
  ) {}

  async register(dto: RegisterDto) {
    this.assertEmailConfigured();
    const exists = await this.db.user.findUnique({
      where: {
        email: dto.email.toLowerCase(),
      },
    });
    if (exists) {
      throw new BadRequestException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.db.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        passwordHash,
      },
    });

    let organization:
      | { id: string; name: string; industry: string; currency: string; schemaName: string }
      | undefined;

    if (dto.organizationName && dto.industry) {
      organization = await this.createOrganizationForUser(user.id, {
        organizationName: dto.organizationName,
        industry: dto.industry,
        currency: dto.currency,
      });
    }

    const otp = await this.issueOtp(user.id, 'signup');
    await this.sendOtpEmail(
      user.email,
      otp.code,
      'Verify your Hesbtk.AI account',
    );

    return {
      user: this.publicUser(user),
      organization,
      onboarding: { nextQuestion: this.onboardingQuestions[0] },
      otpSent: true,
    };
  }

  async login(dto: LoginDto) {
    await this.tenant.ensureAccessControlSchema();
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('This account is deactivated');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email verification is required before signing in');
    }
    if (user.mustChangePassword) {
      throw new UnauthorizedException(
        'Use the invitation email link to change your temporary password before signing in',
      );
    }

    const tenants = await this.db.organizationUser.findMany({
      where: {
        userId: user.id,
        isActive: true,
        OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: new Date() } }],
      },
      include: {
        organization: {
          include: {
            subscriptions: {
              where: { status: 'active', currentPeriodEnd: { gt: new Date() } },
              include: { plan: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return {
      accessToken: this.sign(user),
      user: this.publicUser(user),
      tenants: tenants
        .filter((tenant) => tenant.organization.isActive)
        .map((tenant) => ({
          organizationId: tenant.organizationId,
          schemaName: tenant.organization.schemaName,
          organizationName: tenant.organization.name,
          industry: tenant.organization.industry,
          currency: tenant.organization.currency,
          role: tenant.role,
          accessExpiresAt: tenant.accessExpiresAt,
          permissions: tenant.permissions,
          subscription: this.publicSubscription(tenant.organization.subscriptions[0]),
        })),
    };
  }

  async googleAuth(dto: GoogleAuthDto) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('Google authentication is not configured');
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.credential)}`,
    );
    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google credential');
    }
    const profile = await response.json() as {
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
    };
    if (
      profile.aud !== clientId
      || (profile.email_verified !== 'true' && profile.email_verified !== true)
      || !profile.email
      || !profile.sub
    ) {
      throw new UnauthorizedException('Google credential could not be verified');
    }

    const email = profile.email.toLowerCase();
    let user = await this.db.user.findUnique({ where: { email } });
    if (user && !user.isActive) {
      throw new UnauthorizedException('This account is deactivated');
    }
    if (!user) {
      user = await this.db.user.create({
        data: {
          email,
          fullName: profile.name?.trim() || email.split('@')[0],
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
          emailVerifiedAt: new Date(),
        },
      });
    } else if (!user.emailVerifiedAt || user.mustChangePassword) {
      user = await this.db.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), mustChangePassword: false },
      });
    }

    return {
      accessToken: this.sign(user),
      user: this.publicUser(user),
      tenants: await this.loginTenants(user.id),
    };
  }

  // todo: refactoring the onboarding process
  async getNextOnboardingQuestion(organizationId: string, userId: string) {
    const context = await this.tenant.fromOrganizationId(organizationId, userId);
    const schema = this.tenant.quote(context.schemaName);
    const responses = await this.db.$queryRawUnsafe<{ question_key: string }[]>(
      `SELECT question_key FROM ${schema}.onboarding_responses`,
    );
    return (
      this.onboardingQuestions.find(
        (q) => !responses.some((r) => r.question_key === q.key),
      ) ?? null
    );
  }

  async answerOnboarding(
    organizationId: string,
    userId: string,
    dto: OnboardingAnswerDto,
  ) {
    const context = await this.tenant.fromOrganizationId(organizationId, userId, [
      'owner',
      'accountant',
    ]);
    const schema = this.tenant.quote(context.schemaName);
    await this.db.$executeRawUnsafe(
      `INSERT INTO ${schema}.onboarding_responses (question_key, answer)
       VALUES ($1, $2)`,
      dto.questionKey,
      dto.answer,
    );

    return {
      stored: true,
      nextQuestion: await this.getNextOnboardingQuestion(
        context.organizationId,
        userId,
      ),
    };
  }

  async completeOnboarding(
    organizationId: string | undefined,
    userId: string,
    dto: CompleteOnboardingDto,
  ) {
    const organization =
      organizationId
        ? undefined
        : await this.createOrganizationForUser(userId, {
            organizationName: dto.organizationName,
            industry: dto.industry,
            currency: dto.currency,
          });
    const context = organization
      ? {
          organizationId: organization.id,
          schemaName: organization.schemaName,
          role: 'owner',
        }
      : await this.tenant.fromOrganizationId(organizationId!, userId, [
          'owner',
          'accountant',
        ]);
    const schema = this.tenant.quote(context.schemaName);
    for (const answer of dto.answers) {
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.onboarding_responses (question_key, answer)
         VALUES ($1, $2)`,
        answer.questionKey,
        answer.answer,
      );
    }

    return {
      completed: true,
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            industry: organization.industry,
            currency: organization.currency,
            schemaName: organization.schemaName,
          }
        : undefined,
      tenant: {
        organizationId: context.organizationId,
        schemaName: context.schemaName,
        organizationName: organization?.name,
        industry: organization?.industry,
        currency: organization?.currency,
        role: context.role,
      },
      nextQuestion: await this.getNextOnboardingQuestion(
        context.organizationId,
        userId,
      ),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    this.assertEmailConfigured();
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      return { sent: true };
    }

    const otp = await this.issueOtp(user.id, 'password_reset');
    await this.sendOtpEmail(
      user.email,
      otp.code,
      'Reset your Hesbtk.AI password',
    );

    return {
      sent: true,
      expiresInMinutes: 10,
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    this.assertEmailConfigured();
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      return { sent: true };
    }

    const purpose = dto.purpose as 'signup' | 'password_reset';
    const otp = await this.issueOtp(user.id, purpose);
    const subject =
      purpose === 'signup'
        ? 'Verify your Hesbtk.AI account'
        : 'Reset your Hesbtk.AI password';
    await this.sendOtpEmail(user.email, otp.code, subject);
    return { sent: true, expiresInMinutes: 10 };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired code');
    }
    const purpose = dto.purpose ?? 'signup';
    const otp = await this.findValidOtp(user.id, dto.code, purpose);
    if (purpose === 'signup') {
      await this.db.$transaction([
        this.db.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        }),
        this.db.passwordResetOtp.update({
          where: { id: otp.id },
          data: { usedAt: new Date() },
        }),
      ]);
      const tenants = await this.loginTenants(user.id);
      const verifiedUser = { ...user, emailVerifiedAt: new Date() };
      return {
        verified: true,
        accessToken: this.sign(verifiedUser),
        user: this.publicUser(verifiedUser),
        tenants,
      };
    }
    return { verified: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new BadRequestException('Invalid or expired code');
    }

    const otp = await this.findValidOtp(user.id, dto.code, 'password_reset');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.db.$transaction([
      this.db.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.db.passwordResetOtp.update({
        where: { id: otp.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return { reset: true };
  }

  async inviteMember(
    organizationId: string,
    userId: string,
    dto: InviteMemberDto,
  ) {
    await this.tenant.fromOrganizationId(organizationId, userId, ['owner']);
    await this.tenant.ensureAccessControlSchema();
    if (dto.role !== 'viewer' && dto.accessExpiresAt) {
      throw new BadRequestException('Temporary access dates are only supported for viewers');
    }
    const accessExpiresAt = dto.accessExpiresAt ? new Date(dto.accessExpiresAt) : null;
    if (accessExpiresAt && accessExpiresAt <= new Date()) {
      throw new BadRequestException('Viewer access end date must be in the future');
    }
    const permissions = dto.role === 'viewer'
      ? Array.from(new Set(dto.permissions ?? ['dashboard', 'reports']))
      : [];
    const existingUser = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingUser) {
      if (!existingUser.isActive) {
        throw new BadRequestException('This user account is deactivated');
      }
      const existingMembership = await this.db.organizationUser.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: existingUser.id,
          },
        },
      });
      if (existingMembership?.isActive) {
        throw new BadRequestException('This user is already an active organization member');
      }
      const organization = await this.db.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      if (!organization) throw new NotFoundException('Organization not found');

      await this.sendMembershipEmail(
        existingUser.email,
        'You were added to a Hesbtk.AI organization',
        `You were added to ${organization.name} as ${dto.role}. Sign in with your existing account to access the workspace.`,
      );
      const membership = await this.db.$transaction(async (tx) => {
        const relation = await tx.organizationUser.upsert({
          where: {
            organizationId_userId: {
              organizationId,
              userId: existingUser.id,
            },
          },
          create: {
            organizationId,
            userId: existingUser.id,
            role: dto.role,
            invitedBy: userId,
            joinedAt: new Date(),
            accessExpiresAt,
            permissions,
          },
          update: {
            role: dto.role,
            isActive: true,
            invitedBy: userId,
            joinedAt: new Date(),
            accessExpiresAt,
            permissions,
          },
        });
        await tx.userNotification.create({
          data: {
            userId: existingUser.id,
            organizationId,
            type: 'organization_access',
            title: 'Organization access granted',
            message: `You were added to ${organization.name} as ${dto.role}.`,
          },
        });
        return relation;
      });
      return { membership, emailSent: true, joinedExistingUser: true };
    }
    if (!dto.password) {
      throw new BadRequestException('A temporary password is required for a new user');
    }
    const temporaryPasswordHash = await bcrypt.hash(dto.password, 12);
    const invitedUser = await this.db.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName?.trim() || dto.email.split('@')[0],
        passwordHash: temporaryPasswordHash,
        emailVerifiedAt: new Date(),
        mustChangePassword: true,
      },
    });
    const token = randomBytes(32).toString('hex');
    let invitation;
    try {
      invitation = await this.db.invitation.create({
        data: {
          organizationId,
          email: dto.email.toLowerCase(),
          role: dto.role,
          token,
          invitedBy: userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          accessExpiresAt,
          permissions,
        },
      });
      await this.sendInvitationEmail(
        dto.email.toLowerCase(),
        dto.password,
        invitation.token,
        invitation.expiresAt,
      );
    } catch (error) {
      if (invitation) {
        await this.db.invitation.delete({ where: { id: invitation.id } });
      }
      await this.db.user.delete({ where: { id: invitedUser.id } });
      throw error;
    }

    return {
      invitation,
      emailSent: true,
      acceptUrl: `/accept-invitation?token=${invitation.token}`,
    };
  }

  async invitation(token: string) {
    const invitation = await this.validInvitation(token);
    return {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      expiresAt: invitation.expiresAt,
    };
  }

  async completeInvitation(dto: CompleteInvitationDto) {
    const invitation = await this.validInvitation(dto.token);
    const invitedUser = await this.db.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
    });
    if (!invitedUser || !invitedUser.mustChangePassword) {
      throw new BadRequestException('Invited account is not available');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.db.$transaction([
      this.db.user.update({
        where: { id: invitedUser.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.db.organizationUser.create({
        data: {
          organizationId: invitation.organizationId,
          userId: invitedUser.id,
          role: invitation.role,
          invitedBy: invitation.invitedBy,
          joinedAt: new Date(),
          accessExpiresAt: invitation.accessExpiresAt,
          permissions: invitation.permissions ?? undefined,
        },
      }),
      this.db.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
    return { completed: true, email: invitation.email };
  }

  async acceptInvitation(userId: string, dto: AcceptInvitationDto) {
    const invitation = await this.db.invitation.findUnique({
      where: { token: dto.token },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation is no longer valid');
    }
    const invitedUser = await this.db.user.findUnique({ where: { id: userId } });
    if (!invitedUser || invitedUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new UnauthorizedException('This invitation belongs to another email address');
    }

    await this.db.$transaction(async (tx) => {
      await tx.organizationUser.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId,
          },
        },
        create: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
          invitedBy: invitation.invitedBy,
          joinedAt: new Date(),
          accessExpiresAt: invitation.accessExpiresAt,
          permissions: invitation.permissions ?? undefined,
        },
        update: {
          role: invitation.role,
          isActive: true,
          joinedAt: new Date(),
          accessExpiresAt: invitation.accessExpiresAt,
          permissions: invitation.permissions ?? undefined,
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    return { accepted: true, organizationId: invitation.organizationId };
  }

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    const organization = await this.createOrganizationForUser(userId, {
      organizationName: dto.name,
      industry: dto.industry,
      currency: dto.currency,
    });
    return {
      organizationId: organization.id,
      schemaName: organization.schemaName,
      organizationName: organization.name,
      industry: organization.industry,
      currency: organization.currency,
      role: 'owner',
      permissions: [],
    };
  }

  async organizationAccess(organizationId: string, userId: string) {
    const context = await this.tenant.fromOrganizationId(organizationId, userId);
    return { role: context.role, permissions: context.permissions };
  }

  async members(organizationId: string, userId: string) {
    await this.tenant.fromOrganizationId(organizationId, userId, ['owner']);
    return this.db.organizationUser.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async userNotifications(userId: string) {
    return this.db.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async updateMember(
    organizationId: string,
    memberId: string,
    userId: string,
    dto: UpdateMemberDto,
  ) {
    await this.tenant.fromOrganizationId(organizationId, userId, ['owner']);
    const member = await this.db.organizationUser.findFirst({
      where: { id: memberId, organizationId },
      include: { user: true, organization: true },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.userId === userId && dto.isActive === false) {
      throw new BadRequestException('Owner cannot deactivate their own membership');
    }
    if (dto.role !== 'viewer' && dto.accessExpiresAt) {
      throw new BadRequestException('Temporary access dates are only supported for viewers');
    }

    const nextActive = dto.isActive ?? member.isActive;
    if (member.isActive && !nextActive) {
      await this.sendMembershipEmail(
        member.user.email,
        `Your access to ${member.organization.name} was deactivated`,
        `Your membership in ${member.organization.name} was deactivated by an organization owner.`,
      );
    }
    const updated = await this.db.$transaction(async (tx) => {
      const relation = await tx.organizationUser.update({
        where: { id: memberId },
        data: {
          role: dto.role,
          isActive: dto.isActive,
          accessExpiresAt: dto.accessExpiresAt === undefined
            ? undefined
            : dto.accessExpiresAt ? new Date(dto.accessExpiresAt) : null,
          permissions: dto.permissions,
        },
      });
      if (member.isActive && !nextActive) {
        await tx.userNotification.create({
          data: {
            userId: member.userId,
            organizationId,
            type: 'organization_access',
            severity: 'warning',
            title: 'Organization access deactivated',
            message: `Your access to ${member.organization.name} was deactivated.`,
          },
        });
      }
      return relation;
    });
    return updated;
  }

  async removeMember(organizationId: string, memberId: string, userId: string) {
    await this.tenant.fromOrganizationId(organizationId, userId, ['owner']);
    const member = await this.db.organizationUser.findFirst({
      where: { id: memberId, organizationId },
      include: { user: true, organization: true },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.userId === userId) throw new BadRequestException('Owner cannot remove their own membership');
    await this.sendMembershipEmail(
      member.user.email,
      `You were removed from ${member.organization.name}`,
      `An organization owner removed your access to ${member.organization.name}.`,
    );
    await this.db.$transaction([
      this.db.userNotification.create({
        data: {
          userId: member.userId,
          organizationId,
          type: 'organization_access',
          severity: 'warning',
          title: 'Removed from organization',
          message: `Your access to ${member.organization.name} was removed.`,
        },
      }),
      this.db.organizationUser.delete({ where: { id: memberId } }),
    ]);
    return { removed: true };
  }

  async updateOrganization(
    organizationId: string,
    userId: string,
    dto: UpdateOrganizationDto,
  ) {
    await this.tenant.fromOrganizationId(organizationId, userId, ['owner', 'accountant']);
    return this.db.organization.update({
      where: { id: organizationId },
      data: { name: dto.name, industry: dto.industry, currency: dto.currency },
    });
  }

  async deleteOrganization(organizationId: string, userId: string) {
    await this.tenant.fromOrganizationId(organizationId, userId, ['owner']);
    const organization = await this.db.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('Organization not found');
    await this.db.$transaction([
      this.db.auditLog.deleteMany({ where: { organizationId } }),
      this.db.invitation.deleteMany({ where: { organizationId } }),
      this.db.organizationUser.deleteMany({ where: { organizationId } }),
      this.db.subscription.deleteMany({ where: { organizationId } }),
      this.db.organization.delete({ where: { id: organizationId } }),
    ]);
    await this.db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${organization.schemaName}" CASCADE`);
    return { deleted: true };
  }

  private sign(user: { id: string; email: string; globalRole: string }): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      globalRole: user.globalRole,
    });
  }

  private publicUser(user: {
    id: string;
    fullName: string;
    email: string;
    globalRole: string;
    emailVerifiedAt?: Date | null;
  }) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      globalRole: user.globalRole,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }

  private async issueOtp(userId: string, purpose: 'signup' | 'password_reset') {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 12);
    await this.db.passwordResetOtp.create({
      data: {
        userId,
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return { code };
  }

  private async findValidOtp(
    userId: string,
    code: string,
    purpose: string,
  ) {
    const otps = await this.db.passwordResetOtp.findMany({
      where: {
        userId,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const otp of otps) {
      if (await bcrypt.compare(code, otp.codeHash)) {
        return otp;
      }
    }
    throw new BadRequestException('Invalid or expired code');
  }

  private async createOrganizationForUser(
    userId: string,
    dto: {
      organizationName?: string;
      industry?: string;
      currency?: string;
    },
  ) {
    if (!dto.organizationName || !dto.industry) {
      throw new BadRequestException('Organization name and industry are required');
    }

    const organizationId = randomUUID();
    const schemaName = this.tenant.schemaNameForOrganization(organizationId);
    const organization = await this.db.organization.create({
      data: {
        id: organizationId,
        name: dto.organizationName,
        industry: dto.industry,
        currency: dto.currency ?? 'USD',
        schemaName,
        members: {
          create: {
            userId,
            role: 'owner',
            joinedAt: new Date(),
          },
        },
      },
    });

    await this.tenant.provisionTenantSchema(organization.schemaName);
    await this.tenant.seedChartOfAccounts(
      organization.schemaName,
      organization.industry,
    );
    return organization;
  }

  private async sendOtpEmail(email: string, code: string, subject: string) {
    this.assertEmailConfigured();
    const googleEmail = process.env.GOOGLE_EMAIL!;
    const googleAppPassword = process.env.GOOGLE_APP_PASSWORD!;

    const message = [
      `From: Hesbtk.AI <${googleEmail}>`,
      `To: ${email}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      `Your verification code is ${code}. It expires in 10 minutes.`,
    ].join('\r\n');

    try {
      await this.smtpSend({
        host: 'smtp.gmail.com',
        port: 465,
        user: googleEmail,
        pass: googleAppPassword,
        to: email,
        message,
        rejectUnauthorized: process.env.GOOGLE_SMTP_REJECT_UNAUTHORIZED !== 'false',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown SMTP error';
      throw new BadRequestException(`Could not send OTP email: ${message}`);
    }
    return { sent: true };
  }

  private async sendInvitationEmail(
    email: string,
    temporaryPassword: string,
    token: string,
    expiresAt: Date,
  ) {
    this.assertEmailConfigured();
    const googleEmail = process.env.GOOGLE_EMAIL!;
    const appUrl = process.env.FRONTEND_URL ?? 'http://localhost:8080';
    const acceptUrl = `${appUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
    const message = [
      `From: Hesbtk.AI <${googleEmail}>`,
      `To: ${email}`,
      'Subject: You have been invited to Hesbtk.AI',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'An account was created for you to access a financial workspace.',
      `Email: ${email}`,
      `Temporary password: ${temporaryPassword}`,
      '',
      'You must set a new password before you can access the system:',
      acceptUrl,
      `This invitation link expires on ${expiresAt.toISOString()}.`,
    ].join('\r\n');
    await this.smtpSend({
      host: 'smtp.gmail.com',
      port: 465,
      user: googleEmail,
      pass: process.env.GOOGLE_APP_PASSWORD!,
      to: email,
      message,
      rejectUnauthorized: process.env.GOOGLE_SMTP_REJECT_UNAUTHORIZED !== 'false',
    });
  }

  private async sendMembershipEmail(email: string, subject: string, body: string) {
    this.assertEmailConfigured();
    const googleEmail = process.env.GOOGLE_EMAIL!;
    const message = [
      `From: Hesbtk.AI <${googleEmail}>`,
      `To: ${email}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');
    await this.smtpSend({
      host: 'smtp.gmail.com',
      port: 465,
      user: googleEmail,
      pass: process.env.GOOGLE_APP_PASSWORD!,
      to: email,
      message,
      rejectUnauthorized: process.env.GOOGLE_SMTP_REJECT_UNAUTHORIZED !== 'false',
    });
  }

  private async validInvitation(token: string) {
    const invitation = await this.db.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation is no longer valid');
    }
    return invitation;
  }

  private async loginTenants(userId: string) {
    const memberships = await this.db.organizationUser.findMany({
      where: {
        userId,
        isActive: true,
        OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: new Date() } }],
      },
      include: {
        organization: {
          include: {
            subscriptions: {
              where: { status: 'active', currentPeriodEnd: { gt: new Date() } },
              include: { plan: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    return memberships
      .filter((membership) => membership.organization.isActive)
      .map((membership) => ({
        organizationId: membership.organizationId,
        schemaName: membership.organization.schemaName,
        organizationName: membership.organization.name,
        industry: membership.organization.industry,
        currency: membership.organization.currency,
        role: membership.role,
        accessExpiresAt: membership.accessExpiresAt,
        permissions: membership.permissions,
        subscription: this.publicSubscription(
          membership.organization.subscriptions[0],
        ),
      }));
  }

  private publicSubscription(subscription?: {
    status: string;
    currentPeriodEnd: Date;
    plan: { code: string; name: string; features: unknown };
  }) {
    if (!subscription) return null;
    return {
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      plan: {
        code: subscription.plan.code,
        name: subscription.plan.name,
        features: this.tenant.featureMap(subscription.plan.features),
      },
    };
  }

  private assertEmailConfigured() {
    if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_APP_PASSWORD) {
      throw new BadRequestException(
        'Email OTP is not configured. Set GOOGLE_EMAIL and GOOGLE_APP_PASSWORD.',
      );
    }
  }

  private smtpSend(options: {
    host: string;
    port: number;
    user: string;
    pass: string;
    to: string;
    message: string;
    rejectUnauthorized: boolean;
  }) {
    return new Promise<void>((resolve, reject) => {
      const socket = tls.connect(options.port, options.host, {
        servername: options.host,
        rejectUnauthorized: options.rejectUnauthorized,
      });
      let buffer = '';

      const waitFor = (expected: number[]) =>
        new Promise<string>((res, rej) => {
          const onData = (chunk: Buffer) => {
            buffer += chunk.toString('utf8');
            const lines = buffer.split(/\r?\n/).filter(Boolean);
            const last = lines.at(-1);
            if (!last || /^\d{3}-/.test(last)) return;
            const code = Number(last.slice(0, 3));
            if (expected.includes(code)) {
              socket.off('data', onData);
              const response = buffer;
              buffer = '';
              res(response);
            } else if (code >= 400) {
              socket.off('data', onData);
              rej(new Error(responseForLog(buffer)));
            }
          };
          socket.on('data', onData);
          socket.once('error', rej);
        });

      const send = async (command: string, expected: number[]) => {
        socket.write(`${command}\r\n`);
        await waitFor(expected);
      };

      socket.once('error', reject);
      socket.once('secureConnect', async () => {
        try {
          await waitFor([220]);
          await send('EHLO hesbtk.ai', [250]);
          await send('AUTH LOGIN', [334]);
          await send(Buffer.from(options.user).toString('base64'), [334]);
          await send(Buffer.from(options.pass).toString('base64'), [235]);
          await send(`MAIL FROM:<${options.user}>`, [250]);
          await send(`RCPT TO:<${options.to}>`, [250, 251]);
          await send('DATA', [354]);
          socket.write(`${options.message}\r\n.\r\n`);
          await waitFor([250]);
          await send('QUIT', [221]);
          socket.end();
          resolve();
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      });
    });
  }
}

function responseForLog(response: string) {
  return response.split(/\r?\n/).filter(Boolean).at(-1) ?? 'SMTP error';
}
