import { STREAMING_FRAME_SRC } from '@/lib/streamingCsp';

/**
 * CSP das páginas HTML. Em `/sala`, o SDK Hyperbeam faz `import(blob:…)` após
 * fetch do embed — exige `blob:` em script-src.
 */
export function buildPageCsp(pathname: string): string {
  const isHyperbeamRoom = pathname.startsWith('/sala');

  const scriptParts = [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    ...(isHyperbeamRoom ? ['blob:', 'https://*.hyperbeam.com', 'https://jquery.tutturu.workers.dev'] : []),
    'https://www.youtube.com',
    'https://www.youtube-nocookie.com',
  ];

  const scriptSrc = scriptParts.join(' ');
  const scriptSrcElem = scriptParts.join(' ');

  return [
    isHyperbeamRoom ? "default-src 'self' blob: https: wss: data:" : "default-src 'self'",
    `script-src ${scriptSrc}`,
    `script-src-elem ${scriptSrcElem}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss: blob:",
    "worker-src 'self' blob:",
    "media-src 'self' https: blob: data:",
    `frame-src ${STREAMING_FRAME_SRC}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; ');
}
