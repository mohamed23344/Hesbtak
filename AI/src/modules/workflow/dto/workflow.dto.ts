import {
  IsIn,
  IsString,
} from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @IsIn(['vendor', 'customer'])
  documentSide!: 'vendor' | 'customer';

  @IsString()
  @IsIn(['paid', 'unpaid'])
  paymentStatus!: 'paid' | 'unpaid';
}