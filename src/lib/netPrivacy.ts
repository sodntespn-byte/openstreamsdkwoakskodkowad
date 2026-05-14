import { createHash } from 'crypto';

/** Anonimiza IPv4/IPv6 para logs e rate-limit (sem guardar IP completo). */
export function maskClientIp(raw: string | null | undefined): string {
  if (!raw || raw === 'unknown') return 'anon';
  const ip = raw.trim().split('%')[0];
  if (ip.includes('.')) {
    const p = ip.split('.');
    if (p.length === 4) return `${p[0]}.${p[1]}.0.0`;
    return createHash('sha256').update(ip).digest('hex').slice(0, 16);
  }
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    if (parts.length >= 4) return `${parts.slice(0, 4).join(':')}::`;
    return createHash('sha256').update(ip).digest('hex').slice(0, 16);
  }
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export function clientIpFromRequest(headers: Headers): string {
  const xf = headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim() || 'unknown';
  return headers.get('x-real-ip') || 'unknown';
}
