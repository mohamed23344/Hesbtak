import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDateString, IsIn, IsNotEmpty, IsNumber,
  IsOptional, IsString, ValidateNested,
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

export class PartyInfo {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;
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

export class VoucherDto {
  @IsDateString()
  date!: string;

  @IsString()
  @IsIn(['expense', 'receipt'])
  type!: 'expense' | 'receipt';

  @IsString()
  @IsOptional()
  partyId?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => PartyInfo)
  partyInfo?: PartyInfo;

  @IsString()
  @IsOptional()
  partyType?: 'customer' | 'vendor';

  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  @IsOptional()
  invoiceId?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  invoiceIds?: string[];

  @IsString()
  @IsOptional()
  @IsIn(['cash', 'bank', 'card', 'transfer'])
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  bankAccountId?: string;
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
  discountAmount?: number = 0;

  @IsNumber()
  @IsOptional()
  taxRate?: number = 0;

  @IsString()
  @IsOptional()
  accountId?: string;
}

export class InvoiceDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => PartyInfo)
  customerInfo?: PartyInfo;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsString()
  accountId!: string;

  @IsString()
  relatedAccountId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentLineDto)
  lines!: DocumentLineDto[];

  @IsString()
  @IsOptional()
  @IsIn(['unpaid', 'paid', 'draft'])
  status?: 'unpaid' | 'paid' | 'draft';

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  bankAccountId?: string;
}

export class VendorBillDto {
  @IsString()
  @IsOptional()
  @IsIn(['purchase', 'expense'])
  type?: 'purchase' | 'expense' = 'purchase';

  @IsString()
  @IsOptional()
  vendorId?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => PartyInfo)
  vendorInfo?: PartyInfo;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsString()
  accountId!: string;

  @IsString()
  relatedAccountId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentLineDto)
  lines!: DocumentLineDto[];

  @IsString()
  @IsOptional()
  @IsIn(['received', 'paid', 'draft'])
  status?: 'received' | 'paid' | 'draft';

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  bankAccountId?: string;
}

export class PaymentDto {
  @IsString()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  partyId?: string;

  @IsString()
  @IsOptional()
  partyType?: 'customer' | 'vendor';

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
  accountId?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AttachInvoiceDto extends InvoiceDto {}

export class ReturnLineDto {
  @IsString()
  description!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unitPrice!: number;

  @IsNumber()
  @IsOptional()
  taxRate?: number;
}

export class ReturnDto {
  @IsString()
  @IsOptional()
  invoiceId?: string;

  @IsString()
  @IsOptional()
  billId?: string;

  @IsDateString()
  returnDate!: string;

  @IsString()
  reason!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  lines!: ReturnLineDto[];
}
