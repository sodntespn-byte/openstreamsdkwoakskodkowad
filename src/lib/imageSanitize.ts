import sharp from 'sharp';

const MAX_BYTES = 450 * 1024;

/**
 * Re-encode imagem e remove EXIF/metadata (privacy). Saída JPEG base64.
 */
export async function stripImageDataUrlMetadata(dataUrl: string): Promise<string> {
  const m = /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) {
    throw new Error('Apenas imagens base64 (jpeg, png, webp, gif) são permitidas');
  }
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_BYTES) {
    throw new Error('Imagem demasiado grande');
  }
  const out = await sharp(buf).rotate().jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  if (out.length > MAX_BYTES) {
    throw new Error('Após processamento a imagem continua grande demais');
  }
  return `data:image/jpeg;base64,${out.toString('base64')}`;
}
