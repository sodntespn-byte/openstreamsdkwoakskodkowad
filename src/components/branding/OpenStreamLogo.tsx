'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type OpenStreamLogoProps = {
  className?: string;
  /** `null` = texto sem link */
  href?: string | null;
};

export function OpenStreamLogo({ className, href = '/welcome' }: OpenStreamLogoProps) {
  const label = (
    <span
      className={cn(
        'openstream-wordmark inline-block text-xl font-bold tracking-tight md:text-2xl',
        className
      )}
    >
      OpenStream
    </span>
  );

  if (href === null) {
    return label;
  }

  return (
    <Link
      href={href}
      className="group/openstream-logo inline-block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {label}
    </Link>
  );
}
