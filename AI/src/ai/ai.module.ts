import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClassificationService } from './services/classification.service';
import { AccountMappingService } from './services/account-mapping.service';
import { QwenService } from './services/qwen.service';

@Module({
  imports: [ConfigModule],

  providers: [QwenService, ClassificationService, AccountMappingService],
  exports: [QwenService, ClassificationService, AccountMappingService],
})
export class AiModule {}
