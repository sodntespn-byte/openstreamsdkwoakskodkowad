/**
 * Funcionalidades opcionais — altere aqui ou via variáveis de ambiente.
 *
 * Hyperbeam (sala VM partilhada):
 *   NEXT_PUBLIC_ENABLE_HYPERBEAM=true
 *   HYPERBEAM_API_KEY=sk_test_...   (apenas servidor — nunca no cliente)
 */
export const FEATURES = {
  /** Sala com browser na nuvem (Hyperbeam). Desligue com false ou removendo a env. */
  hyperbeam: process.env.NEXT_PUBLIC_ENABLE_HYPERBEAM === 'true',
} as const;
