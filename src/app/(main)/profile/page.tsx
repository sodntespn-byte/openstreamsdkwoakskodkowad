'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemeId } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ContentGrid } from '@/components/content/ContentGrid';
import { SkeletonProfile } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { STORAGE_KEYS } from '@/lib/constants';
import { resizeAvatarFile } from '@/lib/avatarImage';
import {
  User,
  Heart,
  Clock,
  Settings,
  LogOut,
  Trash2,
  Save,
  Lock,
  Mail,
  ImageIcon,
  Shield,
  Bell,
  Monitor,
  FileText,
  Sparkles,
} from 'lucide-react';
import type { Content } from '@/types/content';
import type { WatchHistoryItem } from '@/types/user';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, updateProfile, changePassword, isLoading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [emailNew, setEmailNew] = useState('');
  const [emailLockPassword, setEmailLockPassword] = useState('');
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdNew2, setPwdNew2] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPwd, setIsSavingPwd] = useState(false);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<Content[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmailNew('');
    }
  }, [user]);

  const loadUserData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [historyRes, favoritesRes] = await Promise.all([
        fetch('/api/history', { credentials: 'include' }),
        fetch('/api/favorites', { credentials: 'include' }),
      ]);

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      }
      if (favoritesRes.ok) {
        const rows = (await favoritesRes.json()) as Array<{
          tmdb_id: number;
          title: string;
          poster_path: string | null;
          media_type: string;
        }>;
        setFavorites(
          rows.map((r) => ({
            id: r.tmdb_id,
            title: r.title,
            name: r.title,
            poster_path: r.poster_path,
            backdrop_path: null,
            media_type: (r.media_type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv',
            vote_average: 0,
            vote_count: 0,
            popularity: 0,
            overview: '',
          }))
        );
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadUserData();
  }, [user, loadUserData]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showToast('Nome não pode estar vazio', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload: {
        name: string;
        email?: string;
        currentPassword?: string;
      } = { name: name.trim() };
      if (emailNew.trim() && emailNew.trim() !== user?.email) {
        payload.email = emailNew.trim();
        payload.currentPassword = emailLockPassword;
      }
      await updateProfile(payload);
      if (emailNew.trim()) setEmailLockPassword('');
      setEmailNew('');
      showToast('Perfil atualizado com sucesso', 'success');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar perfil';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) {
      showToast('Selecione um ficheiro de imagem', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Imagem até 5MB (será redimensionada)', 'error');
      return;
    }
    setAvatarUploading(true);
    try {
      const dataUrl = await resizeAvatarFile(file);
      await updateProfile({ avatar_url: dataUrl });
      showToast('Foto guardada na conta', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar foto';
      showToast(msg, 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const applyTheme = async (t: ThemeId) => {
    setTheme(t);
    try {
      await updateProfile({ theme: t });
    } catch {
      showToast('Tema guardado localmente; falhou ao sincronizar com a conta', 'error');
    }
  };

  const handleChangePassword = async () => {
    if (pwdNew.length < 6 || pwdNew !== pwdNew2) {
      showToast('Senha nova deve coincidir e ter pelo menos 6 caracteres', 'error');
      return;
    }
    setIsSavingPwd(true);
    try {
      await changePassword(pwdCurrent, pwdNew);
      setPwdCurrent('');
      setPwdNew('');
      setPwdNew2('');
      showToast('Senha alterada', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro';
      showToast(msg, 'error');
    } finally {
      setIsSavingPwd(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Tem certeza que deseja limpar todo o histórico?')) return;

    try {
      const res = await fetch('/api/history', { method: 'DELETE' });
      if (res.ok) {
        setHistory([]);
        showToast('Histórico limpo com sucesso', 'success');
      }
    } catch {
      showToast('Erro ao limpar histórico', 'error');
    }
  };

  const handleClearLocalCaches = () => {
    if (
      !confirm(
        'Remover do dispositivo o progresso local em cache, continuar a ver e favoritos em cache? A conta e o histórico no servidor mantêm-se.'
      )
    ) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEYS.history);
      localStorage.removeItem(STORAGE_KEYS.continue);
      localStorage.removeItem(STORAGE_KEYS.favorites);
      showToast('Cache local de visionamento limpo', 'success');
    } catch {
      showToast('Não foi possível limpar o armazenamento local', 'error');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (authLoading || !user) {
    return <SkeletonProfile />;
  }

  const historyAsContent: Content[] = history.map((item) => ({
    id: item.tmdb_id,
    title: item.title,
    name: item.title,
    poster_path: item.poster_path,
    backdrop_path: null,
    media_type: item.media_type as 'movie' | 'tv',
    vote_average: item.vote_average ?? 0,
    vote_count: 0,
    popularity: 0,
    overview: '',
  }));

  const themeLabel =
    theme === 'dark' ? 'Escuro' : theme === 'light' ? 'Claro' : 'Frutiger Aero';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
        <UserAvatar
          name={user.name}
          email={user.email}
          avatarUrl={user.avatarUrl}
          size="md"
          className="ring-2 ring-[var(--border-color)]"
        />
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {user.name || 'Usuário'}
          </h1>
          <p className="text-[var(--text-secondary)]">{user.email}</p>
          {user.isAdmin && (
            <span className="inline-block mt-2 px-2 py-1 bg-[var(--accent-primary)] text-black text-xs rounded">
              Administrador
            </span>
          )}
        </div>
      </div>

      <Tabs defaultValue="history">
        <TabsList className="mb-8 flex-wrap h-auto gap-1">
          <TabsTrigger value="history">
            <Clock size={16} className="mr-2" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="favorites">
            <Heart size={16} className="mr-2" />
            Favoritos
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings size={16} className="mr-2" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              Histórico de visualização
            </h2>
            {history.length > 0 && (
              <Button variant="danger" size="sm" onClick={handleClearHistory} className="gap-2">
                <Trash2 size={16} />
                Limpar histórico
              </Button>
            )}
          </div>

          <ContentGrid
            items={historyAsContent}
            isLoading={isLoadingData}
            showType
            columns={6}
            emptyMessage="Nenhum título no histórico"
          />
        </TabsContent>

        <TabsContent value="favorites">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">Meus favoritos</h2>
          <ContentGrid
            items={favorites}
            isLoading={isLoadingData}
            showType
            columns={6}
            emptyMessage="Nenhum favorito ainda"
          />
        </TabsContent>

        <TabsContent value="settings">
          <div className="max-w-5xl profile-settings-grid grid gap-5 sm:grid-cols-2">
            <article className="profile-settings-card bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-subtle)] sm:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent-primary)]">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Foto de perfil</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Imagem redimensionada no servidor (privacidade)</p>
                </div>
              </div>
              <label
                className={cn(
                  'inline-flex items-center gap-3 font-medium',
                  avatarUploading
                    ? 'text-[var(--text-secondary)] cursor-wait'
                    : 'text-[var(--accent-primary)] cursor-pointer'
                )}
              >
                <ImageIcon size={20} />
                <span className="text-sm">
                  {avatarUploading ? 'A guardar…' : 'Carregar imagem (máx. 400KB)'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={avatarUploading}
                  onChange={handleAvatar}
                />
              </label>
            </article>

            <article className="profile-settings-card bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent-primary)]">
                  <User size={20} />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Dados da conta</h3>
              </div>
              <div className="space-y-4">
                <Input
                  label="Nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  icon={<User size={18} />}
                />
                <Input
                  label="Novo email"
                  type="email"
                  value={emailNew}
                  onChange={(e) => setEmailNew(e.target.value)}
                  placeholder={user.email}
                  icon={<Mail size={18} />}
                />
                {emailNew.trim() && emailNew.trim() !== user.email && (
                  <Input
                    label="Senha atual (obrigatória para mudar email)"
                    type="password"
                    value={emailLockPassword}
                    onChange={(e) => setEmailLockPassword(e.target.value)}
                    icon={<Lock size={18} />}
                  />
                )}
                <Button onClick={handleSaveProfile} loading={isSaving} className="gap-2 w-full sm:w-auto">
                  <Save size={18} />
                  Guardar nome / email
                </Button>
              </div>
            </article>

            <article className="profile-settings-card bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent-primary)]">
                  <Lock size={20} />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Segurança</h3>
              </div>
              <div className="space-y-4">
                <Input
                  label="Senha atual"
                  type="password"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                />
                <Input
                  label="Nova senha"
                  type="password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                />
                <Input
                  label="Confirmar nova senha"
                  type="password"
                  value={pwdNew2}
                  onChange={(e) => setPwdNew2(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={handleChangePassword}
                  loading={isSavingPwd}
                  className="w-full sm:w-auto"
                >
                  Atualizar senha
                </Button>
              </div>
            </article>

            <article className="profile-settings-card bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent-primary)]">
                  <Monitor size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Aparência</h3>
                  <p className="text-sm text-[var(--text-secondary)]">Atual: {themeLabel}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['dark', 'light', 'frutiger'] as ThemeId[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => applyTheme(t)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                      theme === t
                        ? 'bg-[var(--accent-primary)] text-black border-transparent'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--accent-primary)]'
                    )}
                  >
                    {t === 'dark' ? 'Escuro' : t === 'light' ? 'Claro' : 'Frutiger Aero'}
                  </button>
                ))}
              </div>
            </article>

            <article className="profile-settings-card bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-subtle)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent-primary)]">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Privacidade no dispositivo</h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Remove apenas dados guardados neste browser (progresso em cache). O histórico na conta usa o separador Histórico.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="secondary" type="button" onClick={handleClearLocalCaches} className="gap-2">
                  <Trash2 size={18} />
                  Limpar cache local
                </Button>
                <Link
                  href="/privacidade"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
                >
                  <FileText size={18} />
                  Política de privacidade
                </Link>
              </div>
            </article>

            <article className="profile-settings-card bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-subtle)] sm:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent-primary)]">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Sessão e documentos</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Cookies de sessão HttpOnly e SameSite Strict reduzem roubo de sessão por sites externos.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Link
                    href="/termos"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
                  >
                    Termos
                  </Link>
                  <Button variant="danger" onClick={handleLogout} className="gap-2">
                    <LogOut size={18} />
                    Sair
                  </Button>
                </div>
              </div>
            </article>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
