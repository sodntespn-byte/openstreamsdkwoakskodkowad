'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface ChatMessageRow {
  id: string;
  appUserId: number;
  displayName: string;
  text: string;
  createdAt: number;
}

interface PartyChatProps {
  partyId: string;
  authHeaders: () => HeadersInit;
  currentUserId: number;
  title?: string;
}

export function PartyChat({ partyId, authHeaders, currentUserId, title }: PartyChatProps) {
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const lastTsRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    const res = await fetch(
      `/api/hyperbeam/chat?party=${encodeURIComponent(partyId)}&since=${lastTsRef.current}`,
      { credentials: 'include', headers: authHeaders() }
    );
    if (!res.ok) return;
    const data = (await res.json()) as { messages: ChatMessageRow[] };
    const incoming = data.messages || [];
    if (incoming.length === 0) return;
    lastTsRef.current = Math.max(lastTsRef.current, ...incoming.map((m) => m.createdAt));
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const merged = [...prev];
      for (const m of incoming) {
        if (!ids.has(m.id)) merged.push(m);
      }
      return merged.slice(-120);
    });
  }, [partyId, authHeaders]);

  useEffect(() => {
    lastTsRef.current = 0;
    setMessages([]);
    void fetchMessages();
    const id = setInterval(() => void fetchMessages(), 2500);
    return () => clearInterval(id);
  }, [partyId, fetchMessages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/hyperbeam/chat', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: JSON.stringify({ partyId, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar');
      setDraft('');
      if (data.message) {
        setMessages((prev) => [...prev, data.message as ChatMessageRow]);
        lastTsRef.current = Math.max(lastTsRef.current, data.message.createdAt);
      }
    } catch {
      /* ignorar */
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-[280px] flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="border-b border-[var(--border-color)] px-3 py-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <MessageCircle size={16} className="text-[var(--accent-primary)]" />
          Chat {title ? `· ${title}` : ''}
        </h2>
        <p className="text-[10px] text-[var(--text-tertiary)]">
          Comenta o filme, episódio ou o que estiveres a ver
        </p>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2 max-h-52">
        {messages.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-4 text-center">
            Ninguém falou ainda. Diz olá!
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs',
                m.appUserId === currentUserId
                  ? 'ml-4 bg-[var(--accent-primary)]/15 text-[var(--text-primary)]'
                  : 'mr-4 bg-white/5 text-[var(--text-secondary)]'
              )}
            >
              <span className="font-semibold text-[var(--text-primary)]">{m.displayName}</span>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{m.text}</p>
            </div>
          ))
        )}
      </div>

      <form
        className="flex gap-2 border-t border-[var(--border-color)] p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreve uma mensagem…"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />
        <Button type="submit" size="sm" className="shrink-0 px-3" disabled={sending || !draft.trim()}>
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
}
