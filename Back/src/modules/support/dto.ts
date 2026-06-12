import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  subject!: string;

  @IsString()
  @IsIn(['account', 'billing', 'technical', 'feature_request', 'other'])
  category!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class ReplySupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  reply!: string;

  @IsOptional()
  @IsIn(['in_progress', 'resolved', 'closed'])
  status?: string;
}
