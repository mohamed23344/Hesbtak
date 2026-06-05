import { IsIn } from 'class-validator';

export class UploadDocumentDto {
  @IsIn(['vendor', 'customer'])
  documentSide!: 'vendor' | 'customer';

  @IsIn(['paid', 'unpaid'])
  paymentStatus!: 'paid' | 'unpaid';
}