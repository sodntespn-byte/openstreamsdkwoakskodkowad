'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Star, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  imdbId: string | null;
  compact?: boolean;
};

export function MovieRatingsAndCommunity({ tmdbId, mediaType, imdbId, compact }: Props) {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [imdbRating, setImdbRating] = useState<number | null>(null);
  const [blended, setBlended] = useState<number | null>(null);
  const [communityAvg, setCommunityAvg] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [reviews, setReviews] = useState<
    { id: number; user_id: number; rating: number; body: string; created_at: string }[]
  >([]);
  const [ratingInput, setRatingInput] = useState('8');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ media_type: mediaType });
      if (imdbId) q.set('imdb_id', imdbId);
      const res = await fetch(`/api/titles/${tmdbId}/reviews?${q}`);
      const data = await res.json();
      setImdbRating(typeof data.imdb_rating === 'number' ? data.imdb_rating : null);
      setBlended(typeof data.blended_rating === 'number' ? data.blended_rating : null);
      setCommunityAvg(typeof data.community_avg === 'number' ? data.community_avg : null);
      setCount(Number(data.community_count) || 0);
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tmdbId, mediaType, imdbId]);

  const submit = async () => {
    if (!token) return;
    const r = Math.round(Number(ratingInput));
    if (r < 1 || r > 10) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/titles/${tmdbId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ media_type: mediaType, rating: r, body }),
      });
      if (res.ok) {
        setBody('');
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md',
        compact ? 'p-3 text-sm' : 'p-5 md:p-6'
      )}
    >
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <MessageCircle className="text-[var(--accent-primary)] shrink-0" size={compact ? 18 : 22} />
        <h3 className={cn('font-semibold text-white', compact ? 'text-sm' : 'text-lg')}>
          Avaliações & comunidade
        </h3>
        {loading && <span className="text-white/50 text-xs">A carregar…</span>}
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        {imdbId && (
          <div className="rounded-xl bg-white/5 px-3 py-2 border border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-white/50">IMDb</p>
            <p className="text-lg font-bold text-amber-300 tabular-nums">
              {imdbRating != null ? imdbRating.toFixed(1) : '—'}
            </p>
            <p className="text-[10px] text-white/40 font-mono">{imdbId}</p>
          </div>
        )}
        <div className="rounded-xl bg-white/5 px-3 py-2 border border-emerald-500/30">
          <p className="text-[10px] uppercase tracking-wider text-white/50">OpenStream (mistura)</p>
          <p className="text-lg font-bold text-emerald-300 tabular-nums flex items-center gap-1">
            <Star size={16} className="inline shrink-0" />
            {blended != null ? blended.toFixed(1) : '—'}
          </p>
          <p className="text-[10px] text-white/40">
            IMDb + média dos comentários ({count})
          </p>
        </div>
        {communityAvg != null && (
          <div className="rounded-xl bg-white/5 px-3 py-2 border border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-white/50">Só comunidade</p>
            <p className="text-lg font-bold text-white tabular-nums">{communityAvg.toFixed(1)}/10</p>
          </div>
        )}
      </div>

      {user && (
        <div className="space-y-3 mb-4 border-t border-white/10 pt-4">
          <p className="text-white/80 text-sm">O teu comentário atualiza a média da comunidade (1–10).</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="w-full sm:w-24">
              <label className="text-xs text-white/50 block mb-1">Nota</label>
              <Input
                value={ratingInput}
                onChange={(e) => setRatingInput(e.target.value)}
                type="number"
                min={1}
                max={10}
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-white/50 block mb-1">Comentário</label>
              <Input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="O que achaste?"
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            <Button type="button" onClick={submit} loading={submitting} className="shrink-0">
              Publicar
            </Button>
          </div>
        </div>
      )}

      {!user && (
        <p className="text-white/50 text-sm mb-4">Inicia sessão para comentar e influenciar a nota.</p>
      )}

      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
        {reviews.length === 0 && <p className="text-white/40 text-sm">Ainda sem comentários.</p>}
        {reviews.map((rev) => (
          <div key={rev.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
            <div className="flex justify-between gap-2 text-white/90">
              <span className="font-medium text-amber-200">{rev.rating}/10</span>
              <span className="text-[10px] text-white/40">
                {new Date(rev.created_at).toLocaleString('pt-BR')}
              </span>
            </div>
            {rev.body ? <p className="text-white/70 mt-1">{rev.body}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
