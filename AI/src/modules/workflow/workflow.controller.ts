import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { CreateWorkflowDto } from './dto/workflow.dto';
import { WorkflowService } from './workflow.service';

import { UploadFileInterceptor } from './interceptors/file-upload.interceptor';
import { ClassificationService } from '../../ai/services/classification.service';

import { safeJsonParse } from '../../shared/utils/safe-json.util';
import { pdfToImage } from '../../shared/utils/pdf-to-image.util';
import { fileToBase64 } from '../../shared/utils/file-to-base64.util';

import { INVOICE_EXTRACTION_PROMPT } from '../../ai/prompts/invoice-extraction.prompt';
import { QwenService } from '../../ai/services/qwen.service';

@Controller('workflow')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,

    private readonly qwenService: QwenService,

    private readonly classificationService: ClassificationService,
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
    @Param('id')
    workflowId: string,
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    let imagePath = file.path;

    // PDF → Image
    if (file.mimetype === 'application/pdf') {
      imagePath = await pdfToImage(file.path);
    }

    // Image → Base64
    const imageBase64 = fileToBase64(imagePath);

    // Qwen Extraction
    const aiResult = await this.qwenService.extractInvoice(
      imageBase64,
      INVOICE_EXTRACTION_PROMPT,
    );

    const content = aiResult?.choices?.[0]?.message?.content ?? '{}';

    const extractedInvoice = safeJsonParse(content);

    // Save extraction result
    await this.workflowService.saveExtractionResult(
      workflowId,
      extractedInvoice,
    );

    return {
      success: true,

      nextStep: 'WAITING_FOR_USER_CONFIRMATION',

      extractedData: extractedInvoice,
    };
  }

  @Post(':id/confirm-extraction')
  async confirmExtraction(
    @Param('id')
    workflowId: string,
  ) {
    const workflow = await this.workflowService.getWorkflow(workflowId);

    const payload = workflow!.payload as Record<string, any> | undefined;

    const extractionResult = payload?.extractionResult;

    const documentSide = payload?.documentSide;

    const paymentStatus = payload?.paymentStatus;

    const classificationResponse = await this.classificationService.classify({
      invoice: extractionResult,

      documentSide,

      paymentStatus,
    });
    //test
    console.log(JSON.stringify(classificationResponse, null, 2));
    //test
    const content =
      classificationResponse?.choices?.[0]?.message?.content ?? '{}';

    const classification = safeJsonParse(content);

    await this.workflowService.saveClassificationResult(
      workflowId,
      classification,
    );

    return {
      success: true,

      nextStep: 'CONFIRM_CLASSIFICATION',

      classification,
    };
  }
}
