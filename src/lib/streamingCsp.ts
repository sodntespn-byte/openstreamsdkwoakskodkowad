/**
 * Origens permitidas em <iframe> (frame-src) para o player e trailers.
 * Manter alinhado com `ALLOWED_EMBED_DOMAINS` / proxies em `api/proxy/embed`.
 */
export const STREAMING_FRAME_SRC = [
  "'self'",
  'https://superflixapi.cv',
  'https://superflixapi.run',
  'https://superflixapi.buzz',
  'https://superflixapi.top',
  'https://embedtv.best',
  'https://www1.embedtv.best',
  'https://cdn.superflixapi.cv',
  'https://stream.superflixapi.cv',
  'https://cdn.superflixapi.run',
  'https://stream.superflixapi.run',
  'https://111movies.net',
  'https://www.111movies.net',
  'https://warezcdn.site',
  'https://www.warezcdn.site',
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'blob:',
  'data:',
].join(' ');
