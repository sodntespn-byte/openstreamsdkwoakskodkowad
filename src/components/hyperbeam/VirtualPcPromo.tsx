'use client';

import Link from 'next/link';
import { MonitorPlay, ArrowRight } from 'lucide-react';
import { FEATURES } from '@/lib/features';

export function VirtualPcPromo() {
  if (!FEATURES.hyperbeam) return null;

  return (
    <Link
      href="/sala"
      className="group mx-4 mb-2 block overflow-hidden rounded-2xl border border-[var(--accent-primary)]/30 bg-gradient-to-r from-[var(--bg-secondary)] to-[var(--bg-tertiary)] p-4 shadow-lg transition hover:border-[var(--accent-primary)]/60 md:mx-6 md:p-5"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
          <MonitorPlay size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--text-primary)]">Ver juntos</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Cada um com o seu PC virtual + chat para comentar o filme.
          </p>
        </div>
        <ArrowRight
          size={20}
          className="shrink-0 text-[var(--accent-primary)] transition group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}
