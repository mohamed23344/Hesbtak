import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  IsDateString,
  IsEmail,
  IsIn,
  Min,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export type InvoiceSection = 'sales' | 'purchases' | 'expenses';

export class ConfirmPartyDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class ConfirmInvoiceLineDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number = 0;

}

export class ConfirmInvoiceExtractionDto {
  @IsIn(['sales', 'purchases', 'expenses'])
  section!: InvoiceSection;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmPartyDto)
  party?: ConfirmPartyDto;

  @IsDateString()
  issueDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsString()
  accountId!: string;

  @IsString()
  relatedAccountId!: string;

  @IsIn(['draft', 'open', 'paid'])
  status!: 'draft' | 'open' | 'paid';

  @IsOptional()
  @IsIn(['cash', 'bank', 'card', 'transfer'])
  paymentMethod?: 'cash' | 'bank' | 'card' | 'transfer';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmInvoiceLineDto)
  lines!: ConfirmInvoiceLineDto[];
}
