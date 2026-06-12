import {
  Body,
  Controller,
  Headers,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { AiInvoiceExtractionService } from './ai-invoice-extraction.service';
import { ConfirmInvoiceExtractionDto, InvoiceSection } from './dto';

type InvoiceUpload = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@UseGuards(JwtAuthGuard)
@Controller('tenant/ai-invoice-extraction')
export class AiInvoiceExtractionController {
  constructor(
    private readonly tenant: TenantService,
    private readonly extraction: AiInvoiceExtractionService,
  ) {}

  @Post('extract/:section')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async extract(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('section') section: InvoiceSection,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: InvoiceUpload,
  ) {
    const ctx = await this.tenant.fromOrganizationId(
      orgId,
      user.sub,
      ['owner', 'accountant'],
    );
    return this.extraction.extract(ctx, section, file);
  }

  @Post('confirm')
  async confirm(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ConfirmInvoiceExtractionDto,
  ) {
    const ctx = await this.tenant.fromOrganizationId(
      orgId,
      user.sub,
      ['owner', 'accountant'],
    );
    return this.extraction.confirm(ctx, user.sub, dto);
  }
}
