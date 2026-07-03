/**
 * Remove tags HTML e caracteres de controlo — reduz superfície XSS em texto guardado.
 */
export function sanitizePlainText(input: string, maxLen: number): string {
  const s = input
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  return s.slice(0, maxLen);
}
