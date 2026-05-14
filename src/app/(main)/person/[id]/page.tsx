'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { tmdb } from '@/services/tmdb';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function PersonPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [imdbDoc, setImdbDoc] = useState<unknown>(null);
  const [person, setPerson] = useState<Awaited<ReturnType<typeof tmdb.getPersonDetails>> | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Number.isFinite(id)) return;
      setLoading(true);
      try {
        const p = await tmdb.getPersonDetails(id);
        if (cancelled) return;
        setPerson(p);
        const nm = p.external_ids?.imdb_id;
        if (nm) {
          const res = await fetch(`/api/imdb236/${encodeURIComponent(nm)}`);
          const data = await res.json();
          if (!cancelled && data.raw) setImdbDoc(data.raw);
        } else {
          setImdbDoc(null);
        }
      } catch {
        if (!cancelled) setPerson(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-[var(--text-primary)]">
        <Loader2 className="animate-spin w-10 h-10" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-[var(--text-primary)] mb-4">Pessoa não encontrada.</p>
        <Button onClick={() => router.back()}>Voltar</Button>
      </div>
    );
  }

  const imdbSummary =
    imdbDoc && typeof imdbDoc === 'object'
      ? (imdbDoc as Record<string, unknown>)
      : null;

  const knownFor =
    person.combined_credits?.cast
      ?.filter((c) => c.poster_path)
      .sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))
      .slice(0, 12) || [];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16">
      <div className="relative h-48 md:h-64 bg-gradient-to-br from-sky-900/40 to-[var(--bg-secondary)]">
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 text-white hover:bg-black/60"
        >
          <ArrowLeft size={18} />
          Voltar
        </button>
      </div>

      <div className="container mx-auto px-4 -mt-20 relative z-10">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-40 md:w-48 shrink-0 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-2xl overflow-hidden ring-2 ring-[var(--border-color)] shadow-xl">
              <Image
                src={
                  person.profile_path
                    ? tmdb.getImageUrl(person.profile_path, 'h632')
                    : '/icons/icon-192x192.png'
                }
                alt={person.name}
                width={300}
                height={450}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-2">
              {person.name}
            </h1>
            {person.external_ids?.imdb_id && (
              <p className="text-sm font-mono text-[var(--accent-primary)] mb-4">
                IMDb: {person.external_ids.imdb_id}
              </p>
            )}
            <div className="flex flex-wrap gap-3 text-sm text-[var(--text-secondary)] mb-4">
              {person.known_for_department && (
                <span className="px-2 py-1 rounded-lg bg-[var(--bg-tertiary)]">
                  {person.known_for_department}
                </span>
              )}
              {person.birthday && <span>Nasc.: {person.birthday}</span>}
              {person.place_of_birth && <span>{person.place_of_birth}</span>}
            </div>

            {imdbSummary &&
              (Array.isArray(imdbSummary.genres) ? imdbSummary.genres.length > 0 : typeof imdbSummary.genres === 'string') && (
              <div className="flex flex-wrap gap-2 mb-4">
                {(Array.isArray(imdbSummary.genres)
                  ? (imdbSummary.genres as string[])
                  : String(imdbSummary.genres)
                      .split(/[,|]/)
                      .map((s) => s.trim())
                )
                  .slice(0, 8)
                  .map((g) => (
                    <span
                      key={g}
                      className="text-xs px-2 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)]"
                    >
                      {g}
                    </span>
                  ))}
              </div>
            )}

            {person.biography && (
              <p className="text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {person.biography}
              </p>
            )}
          </div>
        </div>

        {knownFor.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
              Conhecido por
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {knownFor.map((item) => {
                const href =
                  item.media_type === 'tv' ? `/watch/tv/${item.id}` : `/watch/movie/${item.id}`;
                const title = item.title || item.name || '—';
                return (
                  <Link
                    key={`${item.media_type}-${item.id}`}
                    href={href}
                    className="shrink-0 w-28 text-center group"
                  >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-[var(--accent-primary)]">
                      <img
                        src={
                          item.poster_path
                            ? tmdb.getImageUrl(item.poster_path, 'w342')
                            : '/icons/icon-192x192.png'
                        }
                        alt={title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-xs text-[var(--text-primary)] mt-2 line-clamp-2">{title}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
