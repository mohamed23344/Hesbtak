import { Module } from '@nestjs/common';

import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { QwenService } from 'src/ai/services/qwen.service';

@Module({
  imports:[],
  controllers: [WorkflowController],
  providers: [WorkflowService,QwenService],
})
export class WorkflowModule {}