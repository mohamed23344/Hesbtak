import { IsArray, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RecurringEntryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(['weekly', 'monthly', 'yearly'])
  frequency!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsArray()
  lines!: { accountId: string; debit: number; credit: number; description?: string }[];
}

export class ChatDto {
  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsNotEmpty()
  question!: string;
}
