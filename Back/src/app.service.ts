import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  // 1. Initialize the logger and give it the context of this service
  private readonly logger = new Logger(AppService.name);

  getHello(): string {
    // 2. Log your custom message! (Using .log() translates to .info() in Pino)
    return 'Hello World!';
  }
}
