import { NextRequest, NextResponse } from 'next/server';
import { fetchSuperflixPlayerHtml, SUPERFLIX_PLAYER_REFERER } from '@/lib/superflixFetch';
import { isSuperflixEmbedHost } from '@/lib/constants';

const EMBEDTV_HOSTS = ['embedtv.best', 'www1.embedtv.best'];

// Dominios que devem ser proxied (bloqueados pelo DNS local)
const PROXY_DOMAINS = [
  'superflixapi.lifestyle',
  'superflixapi.best',
  'superflixapi.cv',
  'superflixapi.run',
  'superflixapi.buzz',
  'superflixapi.top',
  'superflixapi.bond',
  'embedtv.best',
  'www1.embedtv.best',
  'cdn.superflixapi.best',
  'stream.superflixapi.best',
  'cdn.superflixapi.cv',
  'stream.superflixapi.cv',
  'cdn.superflixapi.run',
  'stream.superflixapi.run',
];

function isAllowedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    if (isSuperflixEmbedHost(host)) return true;
    return EMBEDTV_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Anti-hotlinking: só o nosso site (ou NEXT_PUBLIC_APP_URL) pode pedir o embed. */
function isAuthorizedEmbedRequest(request: NextRequest): boolean {
  const secDest = request.headers.get('sec-fetch-dest');
  if (secDest === 'iframe' || secDest === 'embed') {
    return true;
  }

  const secSite = request.headers.get('sec-fetch-site');
  if (secSite === 'same-origin' || secSite === 'same-site') {
    return true;
  }
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host') || '';
  const hostName = host.split(':')[0];
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');

  if (configured) {
    try {
      const allowedOrigin = new URL(configured).origin;
      if (origin === allowedOrigin) return true;
      if (referer && (referer.startsWith(`${allowedOrigin}/`) || referer === allowedOrigin)) {
        return true;
      }
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const u = new URL(referer);
      if (u.hostname === hostName) return true;
    } catch {
      /* ignore */
    }
  }

  return process.env.NODE_ENV !== 'production';
}

function shouldProxyUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return PROXY_DOMAINS.some(
      (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

function toProxyUrl(url: string): string {
  if (!shouldProxyUrl(url)) return url;
  try {
    const path = new URL(url).pathname;
    const isHtmlPlayer =
      /\/filme\//.test(path) || /\/serie\//.test(path) || path.startsWith('/player');
    if (isHtmlPlayer) {
      return `/api/proxy/embed?url=${encodeURIComponent(url)}`;
    }
  } catch {
    /* ignore */
  }
  return `/api/proxy/asset?url=${encodeURIComponent(url)}`;
}

const EARLY_PLAYER_PATCH = `<script>
(function(){
  if(!document.body){document.documentElement.appendChild(document.createElement('body'));}
})();
</script>
<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; connect-src 'self' blob: data:; img-src 'self' blob: data: *; media-src 'self' blob: data: *; style-src 'self' 'unsafe-inline' *; frame-src 'self' *;">`;

function stripAdScripts(html: string): string {
  // Remover scripts de anúncios
  html = html.replace(
    /<script\b[^>]*\ssrc=["'][^"']*(?:chorume|trex\.php|omg10\.com)[^"']*["'][^>]*>\s*<\/script>/gi,
    ''
  );
  
  // Remover scripts do Cloudflare Turnstile - múltiplos padrões
  html = html.replace(
    /<script\b[^>]*\ssrc=["'][^"']*challenges\.cloudflare\.com[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
  html = html.replace(
    /<script\b[^>]*\ssrc=["'][^"']*turnstile[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
  html = html.replace(
    /<script\b[^>]*\ssrc=["'][^"']*cdn-cgi[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
  html = html.replace(
    /<script\b[^>]*\ssrc=["'][^"']*cloudflare\.com[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
  
  // Remover scripts inline que carregam Turnstile
  html = html.replace(
    /<script[^>]*>[\s\S]*?turnstile[\s\S]*?<\/script>/gi,
    ''
  );
  html = html.replace(
    /<script[^>]*>[\s\S]*?Cloudflare[\s\S]*?<\/script>/gi,
    ''
  );
  
  // Remover divs de Turnstile
  html = html.replace(
    /<div\b[^>]*\sclass=["'][^"']*turnstile[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    ''
  );
  
  return html;
}

/** Só reescreve URLs de iframe em strings JS (não toca no array ofuscado). */
function rewriteScriptIframeUrls(script: string): string {
  return script.replace(
    /src=\\"(https?:\\\/\\\/(?:[a-z0-9.-]+\.)?superflixapi\.[a-z]+(?:\\\/[^"]+)*)\\"/gi,
    (match, escaped: string) => {
      const absolute = escaped.replace(/\\\//g, '/');
      if (!shouldProxyUrl(absolute)) return match;
      const proxied = toProxyUrl(absolute);
      return `src=\\"${proxied.replace(/\//g, '\\/')}\\"`;
    }
  );
}

function rewriteHtmlSegment(html: string, baseOrigin: string): string {
  html = html.replace(
    /<iframe\b([^>]*)\ssrc=(["'])(https?:\/\/[^"']+)\2/gi,
    (match, attrs: string, quote: string, url: string) => {
      if (!shouldProxyUrl(url)) return match;
      return `<iframe${attrs} src=${quote}${toProxyUrl(url)}${quote}`;
    }
  );

  html = html.replace(
    /<(script|link)\b([^>]*)\s(src|href)=(["'])(\/player\/[^"']+)\4/gi,
    (match, tag: string, attrs: string, attr: string, quote: string, path: string) => {
      const absoluteUrl = baseOrigin + path;
      if (!shouldProxyUrl(absoluteUrl)) return match;
      return `<${tag}${attrs} ${attr}=${quote}${toProxyUrl(absoluteUrl)}${quote}`;
    }
  );

  html = html.replace(
    /<(iframe|video|audio|source|embed|link)\b([^>]*?)\s(src|href)=(["'])(https?:\/\/[^"']+)\4/gi,
    (match, tag: string, attrs: string, attr: string, quote: string, url: string) => {
      if (!shouldProxyUrl(url)) return match;
      return `<${tag}${attrs} ${attr}=${quote}${toProxyUrl(url)}${quote}`;
    }
  );

  return html;
}

function rewriteUrlsToProxy(html: string, baseOrigin: string): string {
  html = stripAdScripts(html);

  const parts = html.split(/(<script\b[^>]*>[\s\S]*?<\/script>)/gi);
  html = parts
    .map((part, index) => {
      if (index % 2 === 1) return rewriteScriptIframeUrls(part);
      return rewriteHtmlSegment(part, baseOrigin);
    })
    .join('');

  // Neutralizar anti-embed (init ofuscado: __Y[_0x4d066f(0xfc)]())
  html = html.replace(
    /__Y\[_0x4d066f\(0xfc\)\]\(\)/g,
    '(__Y.detectSandbox=function(){},__Y[_0x4d066f(0xfc)]())'
  );

  const interceptorScript = `
<script>
(function() {
  'use strict';
  
  // Neutralizar Cloudflare Turnstile antes de carregar
  if (window.turnstile) {
    window.turnstile = {
      render: function() { return null; },
      execute: function() { return Promise.resolve(null); },
      reset: function() {},
      remove: function() {},
      getResponse: function() { return null; }
    };
  }
  
  // Bloquear carregamento de scripts do Cloudflare
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    const element = originalCreateElement.call(document, tagName);
    if (tagName.toLowerCase() === 'script') {
      const originalSetAttribute = element.setAttribute;
      element.setAttribute = function(name, value) {
        if (name === 'src' && (value.includes('cloudflare.com') || value.includes('cdn-cgi') || value.includes('challenges') || value.includes('turnstile'))) {
          console.log('[Proxy] Bloqueando script Cloudflare:', value);
          return;
        }
        return originalSetAttribute.call(this, name, value);
      };
    }
    return element;
  };
  
  const PROXY_DOMAINS = ${JSON.stringify(PROXY_DOMAINS)};
  const PROXY_BASE = '/api/proxy/';

  function resolveUrl(url) {
    try {
      return new URL(String(url), document.baseURI || window.location.href);
    } catch { return null; }
  }

  function shouldProxy(url) {
    const u = resolveUrl(url);
    if (!u) return false;
    // Bloquear requisições para Cloudflare (Turnstile, RUM, challenges)
    if (u.hostname.includes('cloudflare.com') || 
        u.hostname.includes('cdn-cgi') ||
        u.pathname.includes('/cdn-cgi/') ||
        u.pathname.includes('/challenges/')) {
      return false;
    }
    return PROXY_DOMAINS.some(function(d) {
      return u.hostname === d || u.hostname.endsWith('.' + d);
    });
  }

  function proxyUrl(url) {
    var u = resolveUrl(url);
    var abs = u ? u.href : String(url);
    var ep = (abs.indexOf('.m3u8') !== -1 || abs.indexOf('.ts') !== -1) ? 'hls' : 'asset';
    return PROXY_BASE + ep + '?url=' + encodeURIComponent(abs);
  }

  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url);
    // Bloquear requisições Cloudflare
    if (url && (url.includes('cloudflare.com') || url.includes('cdn-cgi') || url.includes('challenges') || url.includes('turnstile'))) {
      console.log('[Proxy] Bloqueando fetch Cloudflare:', url);
      return Promise.reject(new Error('Cloudflare request blocked'));
    }
    // Proxy URLs permitidas
    if (url && shouldProxy(url)) {
      var proxied = proxyUrl(url);
      input = typeof input === 'string' ? proxied : new Request(proxied, input);
    }
    return originalFetch.call(this, input, init);
  };

  var originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    var args = Array.prototype.slice.call(arguments, 2);
    var resolved = resolveUrl(url);
    if (resolved && resolved.origin === window.location.origin && resolved.pathname.indexOf('/player/') === 0) {
      url = proxyUrl(resolved.href);
    } else if (shouldProxy(url)) {
      url = proxyUrl(url);
    }
    return originalOpen.apply(this, [method, url].concat(args));
  };
})();
</script>`;

  // Injetar patches no head (body cedo + interceptors)
  const headInjection = EARLY_PLAYER_PATCH + interceptorScript;
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>' + headInjection);
  } else if (html.includes('<head ')) {
    html = html.replace(/<head([^>]*)>/, '<head$1>' + headInjection);
  } else {
    html = headInjection + html;
  }

  return html;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const debug = process.env.DEBUG_PROXY === '1';

  if (!url) {
    return NextResponse.json({ error: 'URL é obrigatória' }, { status: 400 });
  }

  if (!isAuthorizedEmbedRequest(request)) {
    return embedErrorHtml('Origem não autorizada', 403);
  }

  if (!isAllowedDomain(url)) {
    return embedErrorHtml('Domínio não permitido', 403);
  }

  try {
    // Usar o referer da request ou o host do site
    const upstreamReferer = SUPERFLIX_PLAYER_REFERER;

    if (debug) {
      console.log('[proxy/embed] fetching', url);
    }
    const result = await fetchSuperflixPlayerHtml(url, upstreamReferer);

    if (!result) {
      return embedErrorHtml(
        'Não foi possível contactar a SuperflixAPI. Verifique a ligação à internet ou tente mais tarde.',
        502
      );
    }

    if (debug) {
      console.log('[proxy/embed] status', result.status, result.finalUrl);
    }

    if (result.status !== 200) {
      return embedErrorHtml(`Servidor retornou HTTP ${result.status}`, result.status);
    }

    let html = result.body;

    const urlObj = new URL(result.finalUrl);
    const baseOrigin = urlObj.origin;

    // Reescrever todas as URLs para usar o proxy
    html = rewriteUrlsToProxy(html, baseOrigin);

    // Adicionar base tag se não existir (para recursos não capturados)
    if (!html.includes('<base')) {
      html = html.replace('<head>', `<head><base href="${baseOrigin}/">`);
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy':
          "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' blob:; worker-src * blob:; style-src * 'unsafe-inline'; img-src * data: blob:; media-src * data: blob:; connect-src * 'self' blob: data:; frame-src *; frame-ancestors 'self'; block-all-mixed-content",
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (debug) {
      console.error('[proxy/embed]', error);
    }
    return embedErrorHtml('Erro interno do proxy', 500);
  }
}

function embedErrorHtml(message: string, status: number): NextResponse {
  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Player</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#f5f5f5;font-family:system-ui,sans-serif;text-align:center;padding:1.5rem}p{max-width:28rem;line-height:1.5;color:#ccc}</style></head><body><p>${message.replace(/</g, '&lt;')}</p></body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'SAMEORIGIN',
      'Cache-Control': 'no-store',
    },
  });
}
