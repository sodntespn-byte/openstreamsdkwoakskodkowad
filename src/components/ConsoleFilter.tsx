'use client';

import { useEffect } from 'react';

/**
 * Filtro de ruído no console (apenas cliente) — evita mismatch de hidratação
 * que ocorria com `<script dangerouslySetInnerHTML>` no `<head>`.
 */
export function ConsoleFilter() {
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;
    const suppress = ['attestation', 'topics', 'react devtools'];
    const shouldSuppress = (args: unknown[]) => {
      const msg = args.map((a) => String(a)).join(' ').toLowerCase();
      return suppress.some((s) => msg.includes(s));
    };
    console.error = function (...args: Parameters<typeof console.error>) {
      if (shouldSuppress(args)) return;
      return originalError.apply(console, args);
    };
    console.warn = function (...args: Parameters<typeof console.warn>) {
      if (shouldSuppress(args)) return;
      return originalWarn.apply(console, args);
    };
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  return null;
}
