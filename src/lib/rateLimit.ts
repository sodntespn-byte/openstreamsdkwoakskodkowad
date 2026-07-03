import { createHash } from 'crypto';

type Bucket = { failures: number; resetAt: number };

const store = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 12;

function bucketKey(maskedIp: string, emailNorm: string): string {
  return createHash('sha256')
    .update(['auth-fail', maskedIp, emailNorm.toLowerCase().slice(0, 120)].join('|'))
    .digest('hex')
    .slice(0, 40);
}

function getBucket(k: string): Bucket {
  const now = Date.now();
  let b = store.get(k);
  if (!b || now > b.resetAt) {
    b = { failures: 0, resetAt: now + WINDOW_MS };
    store.set(k, b);
  }
  return b;
}

/** Bloqueia se já excedeu falhas na janela (antes de processar credencial). */
export function assertAuthFailuresBelowLimit(
  maskedIp: string,
  emailNorm: string
): { ok: true } | { ok: false; retryAfterSec: number } {
  const b = getBucket(bucketKey(maskedIp, emailNorm));
  if (b.failures >= MAX_FAILURES) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - Date.now()) / 1000)) };
  }
  return { ok: true };
}

export function recordAuthFailure(maskedIp: string, emailNorm: string): void {
  const k = bucketKey(maskedIp, emailNorm);
  const b = getBucket(k);
  b.failures += 1;
}

export function resetAuthFailures(maskedIp: string, emailNorm: string): void {
  store.delete(bucketKey(maskedIp, emailNorm));
}
