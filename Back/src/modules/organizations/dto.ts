import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateAdminUserDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @IsIn(['user', 'admin'])
  globalRole?: 'user' | 'admin';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAdminOrganizationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PlanDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  name!: string;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  billingCycle!: string;

  @IsObject()
  @IsOptional()
  features?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  billingCycle?: string;

  @IsObject()
  @IsOptional()
  features?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
