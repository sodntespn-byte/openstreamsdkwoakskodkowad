'use client';

import dynamic from 'next/dynamic';

const HomeClient = dynamic(() => import('./HomeClient'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-primary)] px-4">
      <div
        className="h-12 w-12 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent motion-safe:animate-spin"
        aria-hidden
      />
      <p className="mt-4 text-sm text-[var(--text-secondary)]">A carregar Superflix…</p>
    </div>
  ),
});

export default function HomePage() {
  return <HomeClient />;
}
