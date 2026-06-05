import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { QwenService } from './services/qwen.service';

@Module({
  imports: [ConfigModule],

  providers: [QwenService],

  exports: [QwenService],
})
export class AiModule {}