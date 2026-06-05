import * as fs from 'fs';

export function fileToBase64(
  filePath: string,
): string {
  const file =
    fs.readFileSync(filePath);

  return `data:image/png;base64,${file.toString(
    'base64',
  )}`;
}