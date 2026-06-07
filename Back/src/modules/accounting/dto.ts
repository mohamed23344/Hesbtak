import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AccountDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class PartyDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;
}

export class JournalLineDto {
  @IsString()
  accountId!: string;

  @IsNumber()
  debit!: number;

  @IsNumber()
  credit!: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class JournalEntryDto {
  @IsDateString()
  date!: string;

  @IsString()
  description!: string;

  @IsString()
  @IsOptional()
  @IsIn(['draft', 'posted'])
  status?: 'draft' | 'posted';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class DocumentLineDto {
  @IsString()
  description!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unitPrice!: number;

  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @IsOptional()
  taxRate?: number;

  @IsString()
  @IsOptional()
  accountId?: string;
}

export class InvoiceDto {
  @IsString()
  customerId!: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentLineDto)
  lines!: DocumentLineDto[];
}

export class VendorBillDto {
  @IsString()
  vendorId!: string;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentLineDto)
  lines!: DocumentLineDto[];
}

export class PaymentDto {
  @IsString()
  entityId!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  paymentMethod!: string;

  @IsDateString()
  paymentDate!: string;

  @IsString()
  @IsOptional()
  bankAccountId?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AttachInvoiceDto extends InvoiceDto {}

export class ExpenseDto {
  @IsDateString()
  expenseDate!: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  description!: string;

  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsNumber()
  amount!: number;

  @IsNumber()
  @IsOptional()
  taxAmount?: number;

  @IsString()
  @IsOptional()
  expenseAccountId?: string;

  @IsString()
  paymentMethod!: string;

  @IsString()
  @IsOptional()
  bankAccountId?: string;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}
