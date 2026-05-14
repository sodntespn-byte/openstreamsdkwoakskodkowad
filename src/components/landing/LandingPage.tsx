'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Film, Tv, Radio, Calendar, ChevronDown, Sparkles, Clapperboard, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { LandingPosterWall } from '@/components/landing/LandingPosterWall';

const features = [
  {
    href: '/movies',
    icon: Film,
    title: 'Filmes',
    description: 'Estreias, clássicos e blockbusters em um só lugar.',
  },
  {
    href: '/series',
    icon: Tv,
    title: 'Séries',
    description: 'Binge completo das temporadas que você ama.',
  },
  {
    href: '/tv',
    icon: Radio,
    title: 'TV ao vivo',
    description: 'Canais em tempo real, direto no navegador.',
  },
  {
    href: '/calendario',
    icon: Calendar,
    title: 'Calendário',
    description: 'Saiba quando sai o próximo episódio ou filme.',
  },
] as const;

export function LandingPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const featuresRef = useRef<HTMLElement>(null);
  const [featuresVisible, setFeaturesVisible] = useState(false);

  useEffect(() => {
    const el = featuresRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setFeaturesVisible(true);
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen">
      {!authLoading && isAuthenticated && (
        <div className="border-b border-[var(--border-color)] bg-[var(--accent-primary)]/10 px-4 py-3 text-center animate-fade-in">
          <p className="text-sm text-[var(--text-primary)]">
            Você já está conectado.{' '}
            <Link
              href="/"
              className="inline-flex items-center gap-1 font-semibold text-[var(--accent-primary)] underline-offset-2 hover:underline"
            >
              Abrir o catálogo
              <ArrowRight className="inline h-3.5 w-3.5" aria-hidden />
            </Link>
          </p>
        </div>
      )}

      <section
        className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 pb-12 pt-[calc(var(--header-total)+1rem)] md:pb-16"
        aria-label="Apresentação"
      >
        <LandingPosterWall />
        <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/70 to-black/92" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_20%,rgba(250,204,21,0.12),transparent_50%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <p
            className={cn(
              'mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/80 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-[var(--text-secondary)] backdrop-blur-sm md:text-sm',
              'animate-landing-hero-in landing-hero-delay-1'
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)] motion-safe:animate-pulse" aria-hidden />
            Streaming em HD
          </p>

          <h1
            className={cn(
              'text-display text-balance bg-gradient-to-b from-[var(--text-primary)] to-[var(--text-secondary)] bg-clip-text text-transparent md:mb-6',
              'animate-landing-hero-in landing-hero-delay-2'
            )}
          >
            Filmes, séries e TV ao vivo, sem complicação
          </h1>

          <p
            className={cn(
              'mx-auto mt-4 max-w-2xl text-body text-[var(--text-secondary)] md:mt-6 md:text-lg',
              'animate-landing-hero-in landing-hero-delay-3'
            )}
          >
            Faça login para ver o catálogo completo, o destaque em alta e continuar de onde parou —
            tudo com a cara da Superflix.
          </p>

          <div
            className={cn(
              'mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4',
              'animate-landing-hero-in landing-hero-delay-4'
            )}
          >
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-primary)] px-8 py-3.5 text-sm font-semibold text-black transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]"
            >
              <Clapperboard className="h-4 w-4" aria-hidden />
              Entrar e ver o catálogo
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-tertiary)]/60 px-8 py-3.5 text-sm font-medium text-[var(--text-primary)] backdrop-blur-sm transition-colors hover:border-[var(--accent-primary)]/40 hover:bg-[var(--bg-elevated)]"
            >
              Criar conta
            </Link>
          </div>

          <p
            className={cn(
              'mt-6 text-sm text-[var(--text-tertiary)]',
              'animate-landing-hero-in landing-hero-delay-5'
            )}
          >
            <Link href="#funcionalidades" className="text-[var(--accent-primary)] underline-offset-2 hover:underline">
              Conheça os recursos
            </Link>
            {' · '}
            <span>É grátis criar uma conta.</span>
          </p>
        </div>

        <a
          href="#funcionalidades"
          className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent-primary)] animate-landing-hero-in landing-hero-delay-5"
          aria-label="Ver funcionalidades"
        >
          <span className="text-xs font-medium uppercase tracking-wider">Saiba mais</span>
          <ChevronDown className="h-5 w-5 motion-safe:animate-bounce" aria-hidden />
        </a>
      </section>

      <section
        ref={featuresRef}
        id="funcionalidades"
        className="scroll-mt-[var(--header-total)] border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/40 py-16 md:py-24"
        aria-labelledby="landing-features-heading"
      >
        <div className="mx-auto max-w-6xl px-4">
          <div
            className={cn(
              'mb-12 max-w-2xl md:mb-16',
              featuresVisible && 'animate-landing-hero-in'
            )}
          >
            <h2 id="landing-features-heading" className="text-headline text-[var(--text-primary)]">
              Tudo que você precisa para maratonar
            </h2>
            <p className="mt-3 text-[var(--text-secondary)] md:text-lg">
              Navegue por categorias, use a busca inteligente e sincronize onde parou — em qualquer tela.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {features.map(({ href, icon: Icon, title, description }, i) => (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'group flex h-full flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--bg-primary)]/60 p-6 transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:border-[var(--accent-primary)]/35 motion-safe:hover:shadow-[0_20px_40px_rgba(0,0,0,0.35)]',
                    !featuresVisible && 'opacity-0',
                    featuresVisible && 'animate-landing-card'
                  )}
                  style={
                    featuresVisible
                      ? { animationDelay: `${100 + i * 90}ms` }
                      : undefined
                  }
                >
                  <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-primary)]/12 text-[var(--accent-primary)] transition-colors motion-safe:group-hover:scale-110 motion-safe:group-hover:bg-[var(--accent-primary)]/20 motion-safe:duration-300">
                    <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className="text-title text-[var(--text-primary)]">{title}</span>
                  <span className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{description}</span>
                  <span className="mt-4 text-sm font-medium text-[var(--accent-primary)] opacity-0 transition-opacity motion-safe:group-hover:opacity-100">
                    Abrir →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
