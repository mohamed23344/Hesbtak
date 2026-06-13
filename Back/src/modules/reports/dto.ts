import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const REPORT_TYPES = [
  'profit_loss',
  'balance_sheet',
  'cash_flow',
  'revenue',
  'expense',
  'accounts_receivable',
  'accounts_payable',
  'sales',
  'tax',
  'vendor_payments',
  'customer_invoices',
  'custom',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export class ReportFieldDto {
  @IsString()
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

export class ReportConfigurationDto {
  @IsOptional()
  @IsString()
  datePreset?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFieldDto)
  fields?: ReportFieldDto[];

  @IsOptional()
  @IsString()
  groupBy?: string;

  @IsOptional()
  @IsString()
  @IsIn(['sum', 'average', 'count', 'min', 'max'])
  aggregation?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';

}

export class GenerateReportDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @IsIn(REPORT_TYPES)
  reportType!: ReportType;

  @IsObject()
  @ValidateNested()
  @Type(() => ReportConfigurationDto)
  configuration!: ReportConfigurationDto;

  @IsOptional()
  @IsBoolean()
  save?: boolean;
}

export class UpdateReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReportConfigurationDto)
  configuration?: ReportConfigurationDto;
}

export class CreateScheduleDto {
  @IsString()
  reportId!: string;

  @IsString()
  @IsIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  frequency!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsString()
  timeOfDay!: string;

  @IsString()
  timezone!: string;

  @IsArray()
  @IsString({ each: true })
  recipients!: string[];

  @IsArray()
  @IsString({ each: true })
  deliveryMethods!: string[];

  @IsString()
  @IsIn(['pdf', 'xlsx', 'csv'])
  exportFormat!: 'pdf' | 'xlsx' | 'csv';
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  @IsIn(['active', 'paused'])
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  frequency?: string;

  @IsOptional()
  @IsString()
  timeOfDay?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deliveryMethods?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['pdf', 'xlsx', 'csv'])
  exportFormat?: 'pdf' | 'xlsx' | 'csv';
}
