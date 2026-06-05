import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas, Image } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

export async function pdfToImage(pdfPath: string): Promise<string> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));

  // Fixes the "Image or Canvas expected" error by assigning Node-canvas's Image globally
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    (globalThis as any).Image = Image; 
  }

  const pdf = await pdfjsLib.getDocument({
    data, // Look, no disableWorker here!
  }).promise;

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  const renderContext = {
    canvasContext: context as any,
    canvas: canvas as any,
    viewport,
  };

  await page.render(renderContext).promise;

  const outputPath = path.join(process.cwd(), 'uploads', `page-${Date.now()}.png`);
  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));

  return outputPath;
}