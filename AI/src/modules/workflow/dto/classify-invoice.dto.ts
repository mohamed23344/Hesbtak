export class ClassifyInvoiceDto {
  invoice: any;
  documentSide!: 'vendor' | 'customer';
  paymentStatus!: 'paid' | 'unpaid';
}