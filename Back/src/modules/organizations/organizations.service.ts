import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataBaseService } from '../../database/database.service';
import { JwtUser } from '../../common/auth/current-user.decorator';

@Injectable()
export class OrganizationsService {
  constructor(private readonly db: DataBaseService) {}

  async userTenants(userId: string) {
    const rows = await this.db.organizationUser.findMany({
      where: { userId, isActive: true },
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      industry: row.organization.industry,
      currency: row.organization.currency,
      schemaName: row.organization.schemaName,
      role: row.role,
    }));
  }

  async adminDashboard(user: JwtUser) {
    if (user.globalRole !== 'admin') {
      throw new ForbiddenException('Global admin role required');
    }

    const [organizations, users, invitations, subscriptions] = await Promise.all([
      this.db.organization.count(),
      this.db.user.count(),
      this.db.invitation.count({ where: { acceptedAt: null } }),
      this.db.subscription.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    return {
      organizations,
      users,
      pendingInvitations: invitations,
      subscriptionsByStatus: subscriptions.map((row) => ({
        status: row.status,
        count: row._count.status,
      })),
    };
  }
}
