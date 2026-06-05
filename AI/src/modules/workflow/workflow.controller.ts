import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UploadFileInterceptor } from './interceptors/file-upload.interceptor';
import { safeJsonParse } from '../../shared/utils/safe-json.util';
import { pdfToImage } from '../../shared/utils/pdf-to-image.util';
import { fileToBase64 } from '../../shared/utils/file-to-base64.util';
import { INVOICE_EXTRACTION_PROMPT } from '../../ai/prompts/invoice-extraction.prompt';
import { QwenService } from '../../ai/services/qwen.service';
import { CreateWorkflowDto } from './dto/workflow.dto';
import { WorkflowService } from './workflow.service';

@Controller('workflow')
export class WorkflowController {
  constructor(
    private readonly qwenService: QwenService,
    private readonly workflowService: WorkflowService,
  ) {}

  @Post()
  async createWorkflow(
    @Body()
    dto: CreateWorkflowDto,
  ) {
    return this.workflowService.createWorkflow(
      dto.documentSide,
      dto.paymentStatus,
    );
  }

  @Get(':id')
  async getWorkflow(
    @Param('id')
    id: string,
  ) {
    return this.workflowService.getWorkflow(id);
  }

  @Post(':id/upload')
  @UseInterceptors(UploadFileInterceptor.single())
  async uploadInvoice(
    @Param('id') workflowId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    let imagePath = file.path;

    // Step 1: Detect PDF
    if (file.mimetype === 'application/pdf') {
      imagePath = await pdfToImage(file.path);
    }

    // Step 2: Convert to Base64
    const base64 = fileToBase64(imagePath);

    // Step 3: Call Qwen
    const aiResult = await this.qwenService.extractInvoice(
      base64,
      INVOICE_EXTRACTION_PROMPT,
    );

    const content = aiResult?.choices?.[0]?.message?.content;
    console.log(content);

    const invoice = safeJsonParse(content);
    // Step 4: Save into workflow
    const updated = await this.workflowService.updatePayload(
      workflowId,
      invoice,
    );

    return {
      success: true,
      data: invoice,
      workflow: updated,
    };
  }
}
