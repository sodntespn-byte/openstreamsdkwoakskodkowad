import { stripImageDataUrlMetadata } from '@/lib/imageSanitize';

/** Processamento de foto para perfis de visionamento (apenas servidor). */
export async function normalizeViewerAvatarUrl(
  raw: string | null | undefined
): Promise<string | null> {
  if (raw == null || raw === '') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('data:image/')) return trimmed.slice(0, 500_000);
  try {
    return await stripImageDataUrlMetadata(trimmed);
  } catch {
    if (/^data:image\/jpe?g;base64,/i.test(trimmed) && trimmed.length <= 500_000) {
      return trimmed;
    }
    throw new Error('Imagem inválida ou demasiado grande');
  }
}
