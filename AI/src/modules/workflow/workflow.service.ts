import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { WorkflowStatus } from './enums/workflow-status.enum';
import { WorkflowStep } from './enums/workflow-step.enum';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkflow(documentSide: string, paymentStatus: string) {
    return this.prisma.workflowSession.create({
      data: {
        organizationId: 'org-demo-id',

        createdBy: 'user-demo-id',

        currentStep: WorkflowStep.EXTRACTION,

        status: WorkflowStatus.PENDING,

        payload: {
          document_side: documentSide,

          payment_status: paymentStatus,
        },
      },
    });
  }

  async getWorkflow(workflowId: string) {
    return this.prisma.workflowSession.findUnique({
      where: {
        id: workflowId,
      },
    });
  }

  async updatePayload(workflowId: string, aiResult: any) {
    return this.prisma.workflowSession.update({
      where: {
        id: workflowId,
      },

      data: {
        payload: {
          ai_extraction: aiResult,
        },
        currentStep: 'CLASSIFICATION',
      },
    });
  }
}
