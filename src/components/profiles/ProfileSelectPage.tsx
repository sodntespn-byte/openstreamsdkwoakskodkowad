'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Pencil, Plus, Trash2, ImageIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { useToast } from '@/context/ToastContext';
import { OpenStreamLogo } from '@/components/branding/OpenStreamLogo';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { SerializedViewerProfile } from '@/lib/viewerProfileUtils';
import { AVATAR_GRADIENT_IDS, MAX_VIEWER_PROFILES } from '@/lib/viewerProfileUtils';
import { resizeAvatarFile } from '@/lib/avatarImage';

const AVATAR_BG: Record<string, string> = {
  'gradient-1': 'bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-900',
  'gradient-2': 'bg-gradient-to-br from-emerald-400 via-teal-500 to-slate-900',
  'gradient-3': 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-900',
  'gradient-4': 'bg-gradient-to-br from-sky-400 via-blue-600 to-slate-900',
  'gradient-5': 'bg-gradient-to-br from-pink-400 via-rose-600 to-purple-950',
  'gradient-6': 'bg-gradient-to-br from-lime-400 via-green-600 to-emerald-950',
  'gradient-7': 'bg-gradient-to-br from-fuchsia-500 via-purple-700 to-slate-950',
  'gradient-8': 'bg-gradient-to-br from-neutral-400 via-zinc-600 to-neutral-900',
};

function ProfileAvatar({
  name,
  avatarId,
  avatarUrl,
  className,
}: {
  name: string;
  avatarId: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const initial = (name.trim()[0] || '?').toUpperCase();
  const bg = AVATAR_BG[avatarId] || AVATAR_BG['gradient-1'];

  if (avatarUrl) {
    return (
      <div className={cn('relative aspect-square w-full overflow-hidden rounded-md', className)}>
        <Image src={avatarUrl} alt={name} fill className="object-cover" unoptimized sizes="200px" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex aspect-square w-full items-center justify-center rounded-md text-4xl font-semibold text-white shadow-inner md:text-5xl',
        bg,
        className
      )}
    >
      {initial}
    </div>
  );
}

export function ProfileSelectPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading, logout } = useAuth();
  const { profiles, refreshProfiles, selectProfile, isLoading: profileGateLoading } = useProfile();
  const { showToast } = useToast();

  const [manageMode, setManageMode] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedViewerProfile | 'new' | null>(null);
  const [formName, setFormName] = useState('');
  const [formAvatar, setFormAvatar] = useState<string>('gradient-1');
  const [formAvatarUrl, setFormAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/welcome');
    }
  }, [authLoading, user, router]);

  const openCreate = useCallback(() => {
    if (profiles.length >= MAX_VIEWER_PROFILES) {
      showToast(`Limite de ${MAX_VIEWER_PROFILES} perfis`, 'info');
      return;
    }
    setEditing('new');
    setFormName('');
    setFormAvatar('gradient-1');
    setFormAvatarUrl(user?.avatarUrl ?? null);
    setModalOpen(true);
  }, [profiles.length, showToast, user?.avatarUrl]);

  const openEdit = useCallback((p: SerializedViewerProfile) => {
    setEditing(p);
    setFormName(p.name);
    setFormAvatar(p.avatarId);
    setFormAvatarUrl(p.avatarUrl ?? null);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const handleSave = async () => {
    if (!token) return;
    const trimmed = formName.trim().slice(0, 100);
    if (!trimmed) {
      showToast('Indique um nome', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing === 'new') {
        const res = await fetch('/api/profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: trimmed,
            avatarId: formAvatar,
            avatarUrl: formAvatarUrl,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao criar');
        showToast('Perfil criado', 'success');
      } else if (editing !== null && typeof editing === 'object') {
        const res = await fetch(`/api/profiles/${editing.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: trimmed,
            avatarId: formAvatar,
            avatarUrl: formAvatarUrl,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao guardar');
        showToast('Perfil atualizado', 'success');
      }
      await refreshProfiles();
      closeModal();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erro', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: SerializedViewerProfile) => {
    if (!token) return;
    if (!window.confirm(`Eliminar o perfil «${p.name}»?`)) return;
    try {
      const res = await fetch(`/api/profiles/${p.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao eliminar');
      showToast('Perfil eliminado', 'success');
      await refreshProfiles();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erro', 'error');
    }
  };

  const enterWithProfile = (p: SerializedViewerProfile) => {
    selectProfile(p.id);
    // Check if there's a stored redirect URL
    const redirectUrl = typeof window !== 'undefined' ? sessionStorage.getItem('redirectAfterProfile') : null;
    if (redirectUrl) {
      sessionStorage.removeItem('redirectAfterProfile');
      router.push(redirectUrl);
    } else {
      router.push('/');
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-[var(--text-primary)]">
      <div className="openstream-profile-bg" aria-hidden>
        <div className="openstream-aurora openstream-aurora--a" />
        <div className="openstream-aurora openstream-aurora--b" />
        <div className="openstream-aurora openstream-aurora--c" />
        <div className="openstream-noise" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-16 pt-8 md:px-8 md:pt-12">
        <header className="mb-10 flex items-center justify-between md:mb-14">
          <OpenStreamLogo href={null} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void logout();
                router.push('/welcome');
              }}
              className="rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-white/10 hover:text-[var(--accent-primary)] touch-manipulation min-h-[44px] sm:min-h-0"
            >
              Sair da conta
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center">
          <h1 className="mb-10 text-center text-3xl font-medium text-white md:mb-14 md:text-5xl md:font-normal">
            Quem está a assistir?
          </h1>

          {profileGateLoading && profiles.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="loading-spinner" aria-hidden />
              <p className="text-sm text-[var(--text-secondary)]">A carregar perfis…</p>
            </div>
          ) : null}

          {!(profileGateLoading && profiles.length === 0) ? (
          <ul className="flex flex-wrap items-start justify-center gap-4 md:gap-8">
            {profiles.map((p) => (
              <li key={p.id} className="w-[30vw] max-w-[180px] min-w-[100px] md:max-w-[200px]">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (manageMode) {
                        openEdit(p);
                      } else {
                        enterWithProfile(p);
                      }
                    }}
                    className={cn(
                      'group block w-full text-center transition-transform duration-300 motion-safe:hover:scale-105 motion-safe:hover:z-10',
                      !manageMode && 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] rounded-md'
                    )}
                  >
                    <div className="relative overflow-hidden rounded-md ring-1 ring-white/10 transition-shadow group-hover:ring-[var(--accent-primary)]/50 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                      <ProfileAvatar name={p.name} avatarId={p.avatarId} avatarUrl={p.avatarUrl} />
                      {manageMode && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                          <Pencil className="h-8 w-8 text-[var(--accent-primary)]" aria-hidden />
                        </span>
                      )}
                    </div>
                    <span className="mt-3 block truncate text-sm text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] md:text-base">
                      {p.name}
                    </span>
                  </button>
                  {manageMode && profiles.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(p);
                      }}
                      className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/80 text-red-400 ring-1 ring-white/20 transition-colors hover:bg-red-950/80 hover:text-red-300"
                      aria-label={`Eliminar ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}

            {profiles.length < MAX_VIEWER_PROFILES && (
              <li className="w-[30vw] max-w-[180px] min-w-[100px] md:max-w-[200px]">
                <button
                  type="button"
                  onClick={openCreate}
                  className="group block w-full text-center transition-transform duration-300 motion-safe:hover:scale-105"
                >
                  <div className="flex aspect-square w-full items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15 transition-all group-hover:bg-white/15 group-hover:ring-[var(--accent-primary)]/40">
                    <Plus className="h-12 w-12 text-white md:h-16 md:w-16" strokeWidth={1.25} />
                  </div>
                  <span className="mt-3 block text-sm text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)] md:text-base">
                    Adicionar perfil
                  </span>
                </button>
              </li>
            )}
          </ul>
          ) : null}

          <button
            type="button"
            onClick={() => {
              setManageMode((m) => !m);
              if (modalOpen) closeModal();
            }}
            className="mt-12 min-h-[48px] touch-manipulation rounded border border-white/40 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/90 transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] sm:mt-16 sm:py-2 md:text-sm"
          >
            {manageMode ? 'Concluído' : 'Gerir perfis'}
          </button>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={closeModal} size="md" className="p-6 md:p-8">
        <h2 className="pr-10 text-xl font-semibold text-[var(--text-primary)]">
          {editing === 'new' ? 'Novo perfil' : 'Editar perfil'}
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Nome, foto ou cor do avatar</p>

        <div className="mt-6 space-y-4">
          <Input label="Nome do perfil" value={formName} onChange={(e) => setFormName(e.target.value)} maxLength={100} />

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Foto do perfil</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative h-20 w-20 overflow-hidden rounded-md ring-1 ring-white/15">
                {formAvatarUrl ? (
                  <Image src={formAvatarUrl} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <ProfileAvatar name={formName || '?'} avatarId={formAvatar} className="!rounded-md" />
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--accent-primary)] hover:border-[var(--accent-primary)]">
                <ImageIcon size={18} />
                Carregar foto
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file?.type.startsWith('image/')) return;
                    try {
                      const dataUrl = await resizeAvatarFile(file);
                      setFormAvatarUrl(dataUrl);
                      showToast('Foto pronta — guarde o perfil', 'success');
                    } catch (err: unknown) {
                      showToast(err instanceof Error ? err.message : 'Erro na imagem', 'error');
                    }
                  }}
                />
              </label>
              {user?.avatarUrl && (
                <button
                  type="button"
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                  onClick={() => setFormAvatarUrl(user.avatarUrl ?? null)}
                >
                  Usar foto da conta
                </button>
              )}
              {formAvatarUrl && (
                <button
                  type="button"
                  className="text-sm text-red-400 hover:text-red-300"
                  onClick={() => setFormAvatarUrl(null)}
                >
                  Remover foto
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Cor (se não usar foto)</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {AVATAR_GRADIENT_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFormAvatar(id);
                    setFormAvatarUrl(null);
                  }}
                  className={cn(
                    'aspect-square rounded-md ring-2 ring-offset-2 ring-offset-[var(--bg-secondary)] transition-transform hover:scale-105',
                    AVATAR_BG[id],
                    formAvatar === id && !formAvatarUrl
                      ? 'ring-[var(--accent-primary)]'
                      : 'ring-transparent'
                  )}
                  aria-label={id}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={closeModal}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} loading={saving}>
            Guardar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
