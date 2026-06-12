import { Module } from '@nestjs/common';
import { DataBaseModule } from '../../database/database.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [DataBaseModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
