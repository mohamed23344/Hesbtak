import { Module } from '@nestjs/common';
import { DataBaseService } from './database.service';

@Module({
  exports: [DataBaseService],
  providers: [DataBaseService],
})
export class DataBaseModule {}
