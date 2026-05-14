'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Film, Tv, Radio, User } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const homeHref = '/';

  const navItems = [
    {
      href: homeHref,
      label: 'Início',
      active: pathname === '/' || pathname === '/welcome',
      icon: Home,
    },
    {
      href: '/movies',
      label: 'Filmes',
      active: pathname === '/movies' || pathname.startsWith('/movies/'),
      icon: Film,
    },
    {
      href: '/series',
      label: 'Séries',
      active: pathname === '/series' || pathname.startsWith('/series/'),
      icon: Tv,
    },
    {
      href: '/tv',
      label: 'TV',
      active: pathname === '/tv',
      icon: Radio,
    },
    {
      href: '/profile',
      label: 'Perfil',
      active: pathname === '/profile',
      icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-[var(--safe-bottom)] md:hidden">
      {/* Blur background */}
      <div className="absolute inset-0 glass" />

      {/* Navigation items */}
      <div className="relative flex min-h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-[48px] min-w-[56px] touch-manipulation flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all',
                item.active
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)]'
              )}
            >
              <div
                className={cn(
                  'relative flex items-center justify-center',
                  'transition-transform duration-300',
                  item.active && 'scale-110'
                )}
              >
                <Icon
                  size={22}
                  strokeWidth={item.active ? 2 : 1.5}
                  className="transition-all"
                />
                {/* Active indicator dot */}
                {item.active && (
                  <span className="absolute -bottom-2 w-1 h-1 rounded-full bg-[var(--text-primary)]" />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium transition-opacity',
                  item.active ? 'opacity-100' : 'opacity-60'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
