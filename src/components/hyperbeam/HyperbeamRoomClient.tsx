'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PartyChat } from '@/components/hyperbeam/PartyChat';
import {
  MonitorPlay,
  LogOut,
  Users,
  Copy,
  Power,
  Loader2,
  RefreshCw,
  UserPlus,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SALA_DEFAULT_START_URL } from '@/lib/constants';

interface MemberRow {
  appUserId: number;
  displayName: string;
  online?: boolean;
  hasVm?: boolean;
}

interface SessionState {
  partyId: string;
  title: string;
  embedUrl: string;
  invitePath: string;
  isHost: boolean;
  adminToken: string;
}

export function HyperbeamRoomClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const partyFromUrl = searchParams.get('party') || searchParams.get('room') || '';
  const watchUrlFromQuery = searchParams.get('url') || '';

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  type HbClient = Awaited<ReturnType<typeof import('@hyperbeam/web').default>>;
  const hbRef = useRef<HbClient | null>(null);
  const mountingRef = useRef(false);
  const embedRetriedRef = useRef(false);
  const autoJoinedRef = useRef(false);

  const [session, setSession] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [partyTitle, setPartyTitle] = useState('Ver juntos');
  const [startUrl, setStartUrl] = useState(
    watchUrlFromQuery.startsWith('http') ? watchUrlFromQuery : SALA_DEFAULT_START_URL
  );
  const [inviteUrl, setInviteUrl] = useState('');

  const authHeaders = useCallback((): HeadersInit => {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const refreshMembers = useCallback(
    async (partyId: string) => {
      const res = await fetch(`/api/hyperbeam/participants?party=${encodeURIComponent(partyId)}`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        members: MemberRow[];
        title?: string;
        invitePath?: string;
      };
      setMembers(data.members || []);
      if (data.title) setPartyTitle(data.title);
      if (data.invitePath && typeof window !== 'undefined') {
        setInviteUrl(`${window.location.origin}${data.invitePath}`);
      }
    },
    [authHeaders]
  );

  const applySession = useCallback((data: Record<string, unknown>) => {
    const partyId = String(data.partyId);
    const invitePath = String(data.invitePath || `/sala?party=${partyId}`);
    setSession({
      partyId,
      title: String(data.title || 'Ver juntos'),
      embedUrl: String(data.embedUrl),
      invitePath,
      isHost: Boolean(data.isHost),
      adminToken: String(data.adminToken),
    });
    setPartyTitle(String(data.title || 'Ver juntos'));
    if (typeof window !== 'undefined') {
      setInviteUrl(`${window.location.origin}${invitePath}`);
    }
    setEmbedError(null);
    router.replace(`/sala?party=${partyId}`, { scroll: false });
  }, [router]);

  const joinParty = useCallback(
    async (opts: { createParty?: boolean; forceNew?: boolean; partyId?: string }) => {
      if (!token) {
        showToast('Inicie sessão primeiro', 'error');
        return;
      }
      setLoading(true);
      setEmbedError(null);
      if (opts.forceNew) embedRetriedRef.current = false;

      try {
        const res = await fetch('/api/hyperbeam/session', {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders(),
        body: JSON.stringify({
          partyId: opts.createParty ? undefined : opts.partyId || partyFromUrl || undefined,
          createParty: opts.createParty === true,
          forceNew: opts.forceNew,
          title: partyTitle.trim() || 'Ver juntos',
          startUrl: startUrl.trim() || undefined,
        }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Não foi possível entrar');

        applySession(data);
        if (data.createdParty) {
          showToast('Sala criada — envia o link aos amigos', 'success');
        } else if (data.createdVm) {
          showToast('O teu PC virtual está pronto', 'success');
        } else {
          showToast('Entraste na sala', 'success');
        }
        void refreshMembers(String(data.partyId));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro';
        setEmbedError(msg);
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    },
    [
      token,
      authHeaders,
      partyFromUrl,
      partyTitle,
      startUrl,
      applySession,
      refreshMembers,
      showToast,
    ]
  );

  useEffect(() => {
    if (!authLoading && !user) {
      const path =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : partyFromUrl
            ? `/sala?party=${encodeURIComponent(partyFromUrl)}`
            : '/sala';
      router.replace(`/login?redirect=${encodeURIComponent(path)}`);
    }
  }, [authLoading, user, router, partyFromUrl]);

  useEffect(() => {
    if (!user || !token || session || autoJoinedRef.current) return;
    if (!partyFromUrl) return;
    autoJoinedRef.current = true;
    void joinParty({ partyId: partyFromUrl });
  }, [user, token, session, partyFromUrl, joinParty]);

  const fitVmToContainer = useCallback(() => {
    const el = wrapperRef.current;
    const hb = hbRef.current;
    if (!el || !hb) return;
    const w = Math.floor(el.clientWidth);
    const h = Math.floor(el.clientHeight);
    if (w < 256 || h < 256) return;
    try {
      hb.resize(Math.min(w, 3840), Math.min(h, 3840));
    } catch {
      /* limite maxArea do Hyperbeam */
    }
  }, []);

  const destroyEmbed = useCallback(() => {
    if (hbRef.current) {
      try {
        hbRef.current.destroy();
      } catch {
        /* ignore */
      }
      hbRef.current = null;
    }
    if (containerRef.current) containerRef.current.innerHTML = '';
    mountingRef.current = false;
    setConnected(false);
    setConnecting(false);
  }, []);

  const mountEmbed = useCallback(async () => {
    if (!session || !containerRef.current || hbRef.current || mountingRef.current) return;

    mountingRef.current = true;
    setConnecting(true);
    setEmbedError(null);

    try {
      const { default: Hyperbeam } = await import('@hyperbeam/web');
      const hb = await Hyperbeam(containerRef.current, session.embedUrl, {
        adminToken: session.adminToken,
        delegateKeyboard: true,
      });
      hbRef.current = hb;
      hb.disableInput = false;

      await fetch('/api/hyperbeam/roles', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({
          partyId: session.partyId,
          targetHyperbeamUserId: hb.userId,
          action: 'grant_self',
        }),
      });

      const displayName = user?.name || user?.email?.split('@')[0] || 'Convidado';
      await fetch('/api/hyperbeam/participants', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ partyId: session.partyId, displayName }),
      });

      setConnected(true);
      embedRetriedRef.current = false;
      void refreshMembers(session.partyId);
      wrapperRef.current?.focus();
      requestAnimationFrame(() => fitVmToContainer());
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : 'Erro ao mostrar o PC virtual';
      const looksStale =
        /dynamically imported|Failed to load|terminated|SessionTerminated|Offline/i.test(raw);

      if (looksStale && !embedRetriedRef.current) {
        embedRetriedRef.current = true;
        destroyEmbed();
        setSession(null);
        showToast('A recriar o teu PC virtual…', 'info');
        await joinParty({ partyId: session.partyId, forceNew: true });
        return;
      }

      setEmbedError(
        looksStale
          ? 'Não foi possível ligar ao PC. Verifica o limite de VMs no Hyperbeam ou tenta de novo.'
          : raw
      );
      destroyEmbed();
    } finally {
      setConnecting(false);
      mountingRef.current = false;
    }
  }, [session, user, authHeaders, refreshMembers, showToast, destroyEmbed, joinParty, fitVmToContainer]);

  useEffect(() => {
    if (session && !connected && !connecting && !embedError) {
      void mountEmbed();
    }
  }, [session, connected, connecting, embedError, mountEmbed]);

  useEffect(() => () => destroyEmbed(), [destroyEmbed]);

  useEffect(() => {
    if (!connected || !wrapperRef.current) return;
    const ro = new ResizeObserver(() => fitVmToContainer());
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [connected, fitVmToContainer]);

  useEffect(() => {
    if (!session?.partyId) return;
    const id = setInterval(() => void refreshMembers(session.partyId), 4000);
    return () => clearInterval(id);
  }, [session?.partyId, refreshMembers]);

  const leaveParty = async () => {
    if (session) {
      await fetch(
        `/api/hyperbeam/session?party=${encodeURIComponent(session.partyId)}`,
        { method: 'DELETE', credentials: 'include' }
      );
    }
    destroyEmbed();
    setSession(null);
    setMembers([]);
    router.replace('/sala');
    showToast('Saíste da sala', 'info');
  };

  const endParty = async () => {
    if (!session?.isHost) return;
    if (!confirm('Encerrar a sala e todos os PCs virtuais?')) return;
    try {
      const res = await fetch(
        `/api/hyperbeam/session?party=${encodeURIComponent(session.partyId)}&all=1`,
        { method: 'DELETE', credentials: 'include', headers: authHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await leaveParty();
      showToast('Sala encerrada', 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Erro', 'error');
    }
  };

  const copyInvite = async () => {
    const url = inviteUrl || (session ? `${window.location.origin}${session.invitePath}` : '');
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copiado', 'success');
    } catch {
      showToast(url, 'info');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 md:py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--text-primary)] md:text-3xl">
          <MonitorPlay className="text-[var(--accent-primary)]" />
          Ver juntos
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
          Cada pessoa tem o <strong>próprio PC virtual</strong>. O chat é partilhado para comentarem o
          filme ou série.
        </p>
      </div>

      {!session ? (
        <div className="mx-auto max-w-lg rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 md:p-8">
          {partyFromUrl ? (
            <p className="mb-4 text-sm text-[var(--text-secondary)]">
              A entrar na sala <span className="font-mono text-[var(--accent-primary)]">{partyFromUrl}</span>…
            </p>
          ) : (
            <>
              <Input
                label="Nome da sessão"
                value={partyTitle}
                onChange={(e) => setPartyTitle(e.target.value)}
                placeholder="Ex.: Filme de sexta"
              />
              <Input
                className="mt-3"
                label="Site inicial do teu PC (opcional)"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
                placeholder="https://..."
              />
            </>
          )}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1 gap-2 py-3"
              onClick={() => {
                router.replace('/sala', { scroll: false });
                void joinParty({ createParty: true });
              }}
              loading={loading && !partyFromUrl}
              disabled={loading && !!partyFromUrl}
            >
              <UserPlus size={18} />
              Criar sala
            </Button>
            {partyFromUrl && (
              <Button
                className="flex-1 gap-2 py-3"
                variant="secondary"
                onClick={() => void joinParty({ partyId: partyFromUrl })}
                loading={loading}
              >
                <MonitorPlay size={18} />
                Entrar na sala
              </Button>
            )}
          </div>
          {embedError && (
            <p className="mt-3 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">{embedError}</p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div
              ref={wrapperRef}
              tabIndex={0}
              role="application"
              aria-label="PC virtual"
              onPointerDown={() => wrapperRef.current?.focus()}
              className="relative h-[calc(100dvh-var(--header-total)-11rem)] min-h-[320px] max-h-[82dvh] w-full overflow-hidden rounded-xl bg-black ring-2 ring-[var(--accent-primary)]/30 outline-none focus:ring-[var(--accent-primary)] [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
            >
              <div
                ref={containerRef}
                className="absolute inset-0 h-full w-full cursor-default [&>*]:!h-full [&>*]:!w-full"
              />
              {(connecting || !connected) && !embedError && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
                  <Loader2 className="h-12 w-12 animate-spin text-[var(--accent-primary)]" />
                  <p className="text-sm text-white/80">A preparar o teu PC virtual…</p>
                </div>
              )}
              {embedError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 p-6 text-center">
                  <p className="text-sm text-red-300">{embedError}</p>
                  <Button size="sm" className="gap-2" onClick={() => void joinParty({ partyId: session.partyId, forceNew: true })}>
                    <RefreshCw size={16} />
                    Recriar PC
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
              <p className="mb-1 text-xs font-medium text-[var(--text-secondary)]">Convite da sala</p>
              <div className="flex gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-black/30 px-2 py-1.5 text-xs text-[var(--accent-primary)]">
                  {inviteUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}${session.invitePath}`}
                </code>
                <Button variant="secondary" size="sm" className="shrink-0 gap-1" onClick={() => void copyInvite()}>
                  <Copy size={14} />
                  Copiar
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">
                Código: <span className="font-mono">{session.partyId}</span> — cada amigo terá o PC dele na mesma sala.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => void wrapperRef.current?.requestFullscreen?.()}
              >
                <Maximize2 size={16} />
                Ecrã inteiro
              </Button>
              <Button variant="secondary" size="sm" className="gap-2" onClick={() => void copyInvite()}>
                <Copy size={16} />
                Convidar
              </Button>
              <Button variant="secondary" size="sm" className="gap-2" onClick={() => void leaveParty()}>
                <LogOut size={16} />
                Sair
              </Button>
              {session.isHost && (
                <Button variant="danger" size="sm" className="gap-2" onClick={() => void endParty()}>
                  <Power size={16} />
                  Encerrar sala
                </Button>
              )}
            </div>

            {connected && (
              <p className="text-xs text-[var(--text-tertiary)]">
                Clica na janela preta antes de usar rato e teclado. Cada um controla só o seu PC.
              </p>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                <Users size={18} />
                Na sala ({members.length})
              </h2>
              <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
                {members.length === 0 ? (
                  <li className="text-[var(--text-secondary)]">Só tu por agora</li>
                ) : (
                  members.map((m) => (
                    <li
                      key={m.appUserId}
                      className={cn(
                        'flex items-center justify-between rounded-lg px-2 py-1.5',
                        m.appUserId === user.id && 'bg-white/5'
                      )}
                    >
                      <span className="truncate">
                        {m.displayName}
                        {m.appUserId === user.id && (
                          <span className="ml-1 text-[10px] text-[var(--text-tertiary)]">(tu)</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-[10px]">
                        {m.online !== false && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Online" />
                        )}
                        {m.hasVm && (
                          <span className="text-[var(--accent-primary)]">PC</span>
                        )}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <PartyChat
              partyId={session.partyId}
              authHeaders={authHeaders}
              currentUserId={user.id}
              title={session.title}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
