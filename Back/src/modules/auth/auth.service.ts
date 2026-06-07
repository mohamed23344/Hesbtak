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
  ForgotPasswordDto,
  InviteMemberDto,
  LoginDto,
  OnboardingAnswerDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
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
        email: dto.email,
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
      accessToken: this.sign(user),
      user: this.publicUser(user),
      tenants: organization
        ? [
            {
              organizationId: organization.id,
              schemaName: organization.schemaName,
              organizationName: organization.name,
              industry: organization.industry,
              currency: organization.currency,
              role: 'owner',
            },
          ]
        : [],
      organization,
      onboarding: { nextQuestion: this.onboardingQuestions[0] },
      otpSent: true,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tenants = await this.db.organizationUser.findMany({
      where: { userId: user.id, isActive: true },
      include: { organization: true },
    });

    return {
      accessToken: this.sign(user),
      user: this.publicUser(user),
      tenants: tenants.map((tenant) => ({
        organizationId: tenant.organizationId,
        schemaName: tenant.organization.schemaName,
        organizationName: tenant.organization.name,
        industry: tenant.organization.industry,
        currency: tenant.organization.currency,
        role: tenant.role,
      })),
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
    const token = randomBytes(32).toString('hex');
    const invitation = await this.db.invitation.create({
      data: {
        organizationId,
        email: dto.email.toLowerCase(),
        role: dto.role,
        token,
        invitedBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      invitation,
      emailQueued: true,
      acceptUrl: `/api/v1/auth/accept-invitation`,
    };
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
        },
        update: {
          role: invitation.role,
          isActive: true,
          joinedAt: new Date(),
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    return { accepted: true, organizationId: invitation.organizationId };
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
