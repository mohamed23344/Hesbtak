import { Injectable } from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { diskStorage } from 'multer';

import { extname } from 'path';

@Injectable()
export class UploadFileInterceptor {
  static single() {
    return FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',

        filename: (req, file, callback) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);

          callback(null, `${unique}${extname(file.originalname)}`);
        },
      }),
    });
  }
}
