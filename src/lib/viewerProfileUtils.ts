import type { ViewerProfileRow } from '@/lib/db';

export const AVATAR_GRADIENT_IDS = [
  'gradient-1',
  'gradient-2',
  'gradient-3',
  'gradient-4',
  'gradient-5',
  'gradient-6',
  'gradient-7',
  'gradient-8',
] as const;

export type AvatarGradientId = (typeof AVATAR_GRADIENT_IDS)[number];

export const MAX_VIEWER_PROFILES = 5;

export function isValidAvatarId(id: string): id is AvatarGradientId {
  return (AVATAR_GRADIENT_IDS as readonly string[]).includes(id);
}

export function serializeViewerProfile(r: ViewerProfileRow) {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    avatarId: r.avatar_id,
    avatarUrl: r.avatar_url ?? null,
    sortOrder: r.sort_order,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

export type SerializedViewerProfile = ReturnType<typeof serializeViewerProfile>;
