export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)] px-4 py-10 sm:py-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        aria-hidden
      >
        <div className="absolute -left-1/4 top-0 h-[420px] w-[420px] rounded-full bg-[var(--accent-primary)] blur-[100px]" />
        <div className="absolute -right-1/4 bottom-0 h-[380px] w-[380px] rounded-full bg-cyan-400/30 blur-[90px]" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-400/20 blur-[80px]" />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center">
        <div className="w-full rounded-2xl border border-[var(--border-color)]/60 bg-[var(--glass-bg)]/80 p-6 shadow-[var(--shadow-lg)] backdrop-blur-xl sm:p-8">
          {children}
        </div>
        <p className="mt-6 max-w-sm text-center text-xs text-[var(--text-tertiary)]">
          Ligação encriptada (HTTPS em produção). Cookies de sessão HttpOnly e SameSite Strict.
        </p>
      </div>
    </div>
  );
}
