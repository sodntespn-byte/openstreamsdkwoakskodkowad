'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string | null;
  email?: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-24 h-24 text-3xl',
  lg: 'w-32 h-32 text-4xl',
};

export function UserAvatar({ name, email, avatarUrl, size = 'sm', className }: UserAvatarProps) {
  const initial = (name?.[0] || email?.[0] || '?').toUpperCase();
  const dim = size === 'sm' ? 32 : size === 'md' ? 96 : 128;

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden shrink-0 ring-1 ring-white/10',
        sizeClasses[size],
        !avatarUrl && 'bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center',
        className
      )}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name || 'Avatar'}
          width={dim}
          height={dim}
          className="object-cover w-full h-full"
          unoptimized
        />
      ) : (
        <span className="font-semibold text-white">{initial}</span>
      )}
    </div>
  );
}
