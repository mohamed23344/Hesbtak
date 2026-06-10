import { IsString, IsUUID } from 'class-validator';

export class CreateCheckoutDto {
  @IsUUID()
  planId!: string;
}

export class VerifySubscriptionDto {
  @IsString()
  reference!: string;
}
