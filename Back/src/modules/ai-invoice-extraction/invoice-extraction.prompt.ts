import { InvoiceSection } from './dto';

export function invoiceExtractionPrompt(section: InvoiceSection) {
  const party = section === 'sales' ? 'customer' : 'vendor';
  return `
You are an invoice OCR extraction agent for an ERP system.
Read the attached invoice image and return only JSON matching the requested schema.

Document section: ${section}
Expected party type: ${party}

Rules:
- Extract only information visible in the image. Never invent values.
- If a scalar value is missing or uncertain, return null.
- If a line field is missing or uncertain, return null for that field.
- Dates must use YYYY-MM-DD when confidently visible, otherwise null.
- status must be "paid" only when the invoice clearly states it is paid or settled.
- status must be "draft" only when the document clearly states it is a draft.
- Otherwise status is "open".
- paymentMethod is one of cash, bank, card, transfer, or null.
- taxRate is a percentage, for example 14 for 14%.
- discountAmount is a currency amount, not a percentage.
- Do not calculate missing quantities, prices, taxes, discounts, or dates.
- Include every visible invoice line. If no lines can be read, return an empty array.
- Do not include markdown or explanations.
`.trim();
}

export const INVOICE_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['party', 'issueDate', 'dueDate', 'status', 'paymentMethod', 'lines'],
  properties: {
    party: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'email', 'phone', 'address'],
      properties: {
        name: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        address: { type: ['string', 'null'] },
      },
    },
    issueDate: { type: ['string', 'null'] },
    dueDate: { type: ['string', 'null'] },
    status: { type: ['string', 'null'], enum: ['draft', 'open', 'paid', null] },
    paymentMethod: {
      type: ['string', 'null'],
      enum: ['cash', 'bank', 'card', 'transfer', null],
    },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'description',
          'quantity',
          'unitPrice',
          'discountAmount',
          'taxRate',
        ],
        properties: {
          description: { type: ['string', 'null'] },
          quantity: { type: ['number', 'null'] },
          unitPrice: { type: ['number', 'null'] },
          discountAmount: { type: ['number', 'null'] },
          taxRate: { type: ['number', 'null'] },
        },
      },
    },
  },
} as const;
