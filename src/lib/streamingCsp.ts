/**
 * Origens permitidas em <iframe> (frame-src) para o player e trailers.
 * Manter alinhado com `ALLOWED_EMBED_DOMAINS` / proxies em `api/proxy/embed`.
 */
export const STREAMING_FRAME_SRC = [
  "'self'",
  'https://superflixapi.best',
  'https://superflixapi.cv',
  'https://superflixapi.run',
  'https://superflixapi.buzz',
  'https://superflixapi.top',
  'https://superflixapi.bond',
  'https://superflixapi.lifestyle',
  'https://cdn.superflixapi.best',
  'https://stream.superflixapi.best',
  'https://embedtv.best',
  'https://www1.embedtv.best',
  'https://cdn.superflixapi.cv',
  'https://stream.superflixapi.cv',
  'https://cdn.superflixapi.run',
  'https://stream.superflixapi.run',
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://*.hyperbeam.com',
  'blob:',
  'data:',
].join(' ');
