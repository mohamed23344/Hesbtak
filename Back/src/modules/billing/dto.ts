import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCheckoutDto {
  @IsUUID()
  planId!: string;
}

export class CreateOnboardingCheckoutDto extends CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  organizationName!: string;

  @IsString()
  @IsNotEmpty()
  industry!: string;

  @IsString()
  @IsOptional()
  currency?: string;
}

export class VerifySubscriptionDto {
  @IsString()
  reference!: string;
}
