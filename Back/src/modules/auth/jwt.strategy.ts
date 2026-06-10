import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtUser } from '../../common/auth/current-user.decorator';
import { DataBaseService } from '../../database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly db: DataBaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
    });
  }

  async validate(payload: JwtUser): Promise<JwtUser> {
    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
      select: {
        isActive: true,
        emailVerifiedAt: true,
        mustChangePassword: true,
      },
    });
    if (
      !user?.isActive ||
      !user.emailVerifiedAt ||
      user.mustChangePassword
    ) {
      throw new UnauthorizedException('Account access is not enabled');
    }
    return payload;
  }
}
