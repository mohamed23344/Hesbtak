import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as tls from 'node:tls';
import { DataBaseService } from '../../database/database.service';
import { JwtUser } from '../../common/auth/current-user.decorator';
import {
  PlanDto,
  UpdateAdminOrganizationDto,
  UpdateAdminUserDto,
  UpdatePlanDto,
} from './dto';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly db: DataBaseService,
    private readonly tenant: TenantService,
  ) {}

  async userTenants(userId: string) {
    const rows = await this.db.organizationUser.findMany({
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
      orderBy: { createdAt: 'desc' },
    });

    return rows
      .filter((row) => row.organization.isActive)
      .map((row) => {
        const subscription = row.organization.subscriptions[0];
        return {
          organizationId: row.organizationId,
          organizationName: row.organization.name,
          industry: row.organization.industry,
          currency: row.organization.currency,
          schemaName: row.organization.schemaName,
          role: row.role,
          accessExpiresAt: row.accessExpiresAt,
          permissions: row.permissions,
          subscription: subscription
            ? {
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd,
                plan: {
                  code: subscription.plan.code,
                  name: subscription.plan.name,
                  features: this.tenant.featureMap(subscription.plan.features),
                },
              }
            : null,
        };
      });
  }

  async adminDashboard(user: JwtUser) {
    this.ensureAdmin(user);

    const [
      organizations,
      activeOrganizations,
      users,
      activeUsers,
      invitations,
      plans,
      activePlans,
      subscriptions,
      recentUsers,
      recentOrganizations,
    ] = await Promise.all([
      this.db.organization.count(),
      this.db.organization.count({ where: { isActive: true } }),
      this.db.user.count(),
      this.db.user.count({ where: { isActive: true } }),
      this.db.invitation.count({ where: { acceptedAt: null } }),
      this.db.plan.count(),
      this.db.plan.count({ where: { isActive: true } }),
      this.db.subscription.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.db.user.count({
        where: { createdAt: { gte: this.daysAgo(30) } },
      }),
      this.db.organization.count({
        where: { createdAt: { gte: this.daysAgo(30) } },
      }),
    ]);

    return {
      organizations,
      activeOrganizations,
      inactiveOrganizations: organizations - activeOrganizations,
      users,
      activeUsers,
      inactiveUsers: users - activeUsers,
      pendingInvitations: invitations,
      plans,
      activePlans,
      recentUsers,
      recentOrganizations,
      subscriptionsByStatus: subscriptions.map((row) => ({
        status: row.status,
        count: row._count.status,
      })),
    };
  }

  async adminUsers(user: JwtUser) {
    this.ensureAdmin(user);
    return this.db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        globalRole: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        _count: { select: { memberships: true, invitations: true } },
      },
    });
  }

  async adminUser(user: JwtUser, id: string) {
    this.ensureAdmin(user);
    const row = await this.db.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        globalRole: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
        memberships: {
          include: { organization: true },
          orderBy: { createdAt: 'desc' },
        },
        invitations: {
          include: { organization: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!row) throw new NotFoundException('User not found');
    return row;
  }

  async updateAdminUser(user: JwtUser, id: string, dto: UpdateAdminUserDto) {
    this.ensureAdmin(user);
    if (id === user.sub && dto.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own admin user');
    }
    if (id === user.sub && dto.globalRole === 'user') {
      throw new BadRequestException('You cannot remove your own admin role');
    }
    const existing = await this.db.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.isActive && dto.isActive === false) {
      await this.sendEmail(
        existing.email,
        'Your Hesbtk.AI account was deactivated',
        'A platform administrator deactivated your Hesbtk.AI account. Contact support if you believe this was a mistake.',
      );
    }
    return this.db.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        email: dto.email?.toLowerCase(),
        globalRole: dto.globalRole,
        isActive: dto.isActive,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        globalRole: true,
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });
  }

  async deleteAdminUser(user: JwtUser, id: string) {
    this.ensureAdmin(user);
    if (id === user.sub) {
      throw new BadRequestException('You cannot delete your own admin user');
    }
    const existing = await this.db.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    await this.sendEmail(
      existing.email,
      'Your Hesbtk.AI account was removed',
      'A platform administrator removed your Hesbtk.AI account and organization access.',
    );
    await this.db.$transaction([
      this.db.passwordResetOtp.deleteMany({ where: { userId: id } }),
      this.db.auditLog.deleteMany({ where: { userId: id } }),
      this.db.invitation.deleteMany({ where: { invitedBy: id } }),
      this.db.organizationUser.deleteMany({ where: { invitedBy: id } }),
      this.db.organizationUser.deleteMany({ where: { userId: id } }),
      this.db.user.delete({ where: { id } }),
    ]);
    return { deleted: true };
  }

  async adminOrganizations(user: JwtUser) {
    this.ensureAdmin(user);
    return this.db.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { members: true, invitations: true, subscriptions: true },
        },
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async adminOrganization(user: JwtUser, id: string) {
    this.ensureAdmin(user);
    const row = await this.db.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: true },
          orderBy: { createdAt: 'desc' },
        },
        invitations: { orderBy: { createdAt: 'desc' }, take: 10 },
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Organization not found');
    return row;
  }

  async updateAdminOrganization(
    user: JwtUser,
    id: string,
    dto: UpdateAdminOrganizationDto,
  ) {
    this.ensureAdmin(user);
    const existing = await this.db.organization.findUnique({
      where: { id },
      include: { members: { include: { user: true } } },
    });
    if (!existing) throw new NotFoundException('Organization not found');
    if (existing.isActive && dto.isActive === false) {
      await Promise.all(existing.members.map((member) => this.sendEmail(
        member.user.email,
        `Access to ${existing.name} was deactivated`,
        `A platform administrator deactivated ${existing.name}. You cannot access this organization until it is reactivated.`,
      )));
      await this.db.userNotification.createMany({
        data: existing.members.map((member) => ({
          userId: member.userId,
          organizationId: id,
          type: 'organization_access',
          severity: 'warning',
          title: 'Organization deactivated',
          message: `${existing.name} was deactivated by a platform administrator.`,
        })),
      });
    }
    return this.db.organization.update({
      where: { id },
      data: {
        name: dto.name,
        industry: dto.industry,
        currency: dto.currency,
        isActive: dto.isActive,
      },
    });
  }

  async deleteAdminOrganization(user: JwtUser, id: string) {
    this.ensureAdmin(user);
    const organization = await this.db.organization.findUnique({
      where: { id },
      include: { members: { include: { user: true } } },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    await Promise.all(organization.members.map((member) => this.sendEmail(
      member.user.email,
      `You were removed from ${organization.name}`,
      `A platform administrator deleted ${organization.name}. Your access to this organization has been removed.`,
    )));
    await this.db.$transaction([
      this.db.userNotification.createMany({
        data: organization.members.map((member) => ({
          userId: member.userId,
          organizationId: id,
          type: 'organization_access',
          severity: 'warning',
          title: 'Organization removed',
          message: `${organization.name} was removed by a platform administrator.`,
        })),
      }),
      this.db.auditLog.deleteMany({ where: { organizationId: id } }),
      this.db.invitation.deleteMany({ where: { organizationId: id } }),
      this.db.organizationUser.deleteMany({ where: { organizationId: id } }),
      this.db.subscription.deleteMany({ where: { organizationId: id } }),
      this.db.organization.delete({ where: { id } }),
    ]);
    await this.db.$executeRawUnsafe(
      `DROP SCHEMA IF EXISTS "${organization.schemaName}" CASCADE`,
    );
    return { deleted: true };
  }

  async adminPlans(user: JwtUser) {
    this.ensureAdmin(user);
    return this.db.plan.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async createPlan(user: JwtUser, dto: PlanDto) {
    this.ensureAdmin(user);
    return this.db.plan.create({
      data: {
        code: dto.code ?? dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        name: dto.name,
        price: dto.price,
        currency: dto.currency ?? 'EGP',
        billingCycle: dto.billingCycle,
        features: (dto.features ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updatePlan(user: JwtUser, id: string, dto: UpdatePlanDto) {
    this.ensureAdmin(user);
    return this.db.plan.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        price: dto.price,
        currency: dto.currency,
        billingCycle: dto.billingCycle,
        features: dto.features as Prisma.InputJsonValue | undefined,
        isActive: dto.isActive,
      },
    });
  }

  async deletePlan(user: JwtUser, id: string) {
    this.ensureAdmin(user);
    const subscriptions = await this.db.subscription.count({
      where: { planId: id },
    });
    if (subscriptions > 0) {
      throw new BadRequestException('Cannot delete a plan with subscriptions');
    }
    await this.db.plan.delete({ where: { id } });
    return { deleted: true };
  }

  private ensureAdmin(user: JwtUser) {
    if (user.globalRole !== 'admin') {
      throw new ForbiddenException('Global admin role required');
    }
  }

  private daysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private async sendEmail(to: string, subject: string, body: string) {
    const email = process.env.GOOGLE_EMAIL;
    const password = process.env.GOOGLE_APP_PASSWORD;
    if (!email || !password) {
      throw new BadRequestException('Email is not configured');
    }
    const message = [
      `From: Hesbtk.AI <${email}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');
    await smtpSend({
      user: email,
      pass: password,
      to,
      message,
      rejectUnauthorized: process.env.GOOGLE_SMTP_REJECT_UNAUTHORIZED !== 'false',
    });
  }
}

function smtpSend(options: {
  user: string; pass: string; to: string; message: string; rejectUnauthorized: boolean;
}) {
  return new Promise<void>((resolve, reject) => {
    const socket = tls.connect(465, 'smtp.gmail.com', {
      servername: 'smtp.gmail.com',
      rejectUnauthorized: options.rejectUnauthorized,
    });
    let buffer = '';
    const waitFor = (expected: number[]) => new Promise<void>((res, rej) => {
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const last = buffer.split(/\r?\n/).filter(Boolean).at(-1);
        if (!last || /^\d{3}-/.test(last)) return;
        const code = Number(last.slice(0, 3));
        if (expected.includes(code)) {
          socket.off('data', onData);
          buffer = '';
          res();
        } else if (code >= 400) {
          socket.off('data', onData);
          rej(new Error(last));
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
