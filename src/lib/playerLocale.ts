/**
 * Deteção leve de região/idioma do browser para ranking de fontes de embed
 * e cabeçalho Accept-Language no proxy (legendas/áudio quando o upstream respeita).
 */

export type ViewerRegionHint = 'brazil' | 'iberia' | 'latam' | 'us' | 'other';

/** Fuso → região aproximada (sem geolocalização por IP). */
export function getViewerRegionHint(): ViewerRegionHint {
  if (typeof Intl === 'undefined') return 'other';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (
      /America\/(Sao_Paulo|Bahia|Belem|Fortaleza|Recife|Manaus|Noronha|Campo_Grande|Cuiaba|Maceio|Rio_Branco|Porto_Velho|Boa_Vista)/i.test(
        tz
      )
    ) {
      return 'brazil';
    }
    if (/Europe\/(Lisbon|Madeira|Azores)/i.test(tz)) return 'iberia';
    if (/^America\//i.test(tz)) return 'latam';
    if (/^(US\/|America\/(New_York|Los_Angeles|Chicago|Denver|Phoenix))/i.test(tz)) return 'us';
  } catch {
    /* ignore */
  }
  return 'other';
}

/** Tag principal (ex.: pt-BR, en-US) a partir do browser + reforço Brasil pelo fuso. */
export function getViewerPrimaryLanguage(): string {
  if (typeof navigator === 'undefined') return 'pt-BR';
  const nav = (navigator.language || 'pt-BR').slice(0, 16);
  const region = getViewerRegionHint();
  if (region === 'brazil') return 'pt-BR';
  if (region === 'iberia' && /^pt/i.test(nav)) return 'pt-PT';
  return nav || 'pt-BR';
}

/** Cabeçalho Accept-Language completo a enviar ao upstream via proxy. */
export function acceptLanguageHeaderFromPrimary(primary: string): string {
  const p = primary.replace(/[^a-zA-Z-]/g, '').slice(0, 16) || 'pt-BR';
  const pl = p.toLowerCase();
  if (pl.startsWith('pt')) return `${p},pt;q=0.98,en-US;q=0.85,en;q=0.75`;
  if (pl.startsWith('es')) return `${p},es;q=0.98,en-US;q=0.85,pt-BR;q=0.45`;
  if (pl.startsWith('en')) return `${p},en;q=0.98,pt-BR;q=0.55`;
  return `${p},en-US;q=0.88,pt-BR;q=0.65,en;q=0.6`;
}
