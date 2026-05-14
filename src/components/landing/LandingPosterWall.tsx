'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type Poster = { id: number; url: string };

const ROW_COUNT = 7;

function splitIntoRows(posters: Poster[], rows: number): Poster[][] {
  const out: Poster[][] = Array.from({ length: rows }, () => []);
  posters.forEach((p, i) => {
    out[i % rows].push(p);
  });
  return out.filter((r) => r.length > 0);
}

function HorizontalMarquee({
  posters,
  reverse,
  durationSec,
  rowIndex,
}: {
  posters: Poster[];
  reverse?: boolean;
  durationSec: number;
  rowIndex: number;
}) {
  if (posters.length === 0) return null;
  const wave = rowIndex % 2 === 0 ? 'landing-flow-wave-a' : 'landing-flow-wave-b';
  return (
    <div className={cn('landing-flow__row', wave)}>
      <div
        className="landing-flow__track"
        style={{
          animationDuration: `${durationSec}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        <div className="landing-flow__strip">
          {posters.map((p) => (
            <div key={p.id} className="landing-flow__cell">
              <img
                src={p.url}
                alt=""
                width={140}
                height={210}
                className="landing-flow__img"
                loading="eager"
                decoding="async"
                draggable={false}
              />
            </div>
          ))}
        </div>
        <div className="landing-flow__strip" aria-hidden>
          {posters.map((p) => (
            <div key={`d-${p.id}`} className="landing-flow__cell">
              <img
                src={p.url}
                alt=""
                width={140}
                height={210}
                className="landing-flow__img"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Fundo da landing: fileiras horizontais em fluxo (parallax leve),
 * largura total com capas parcialmente cortadas nas margens — estética distinta do muro em perspetiva Netflix.
 */
export function LandingPosterWall() {
  const [posters, setPosters] = useState<Poster[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/landing-posters');
        const data = (await res.json()) as { posters?: Poster[] };
        if (!cancelled && Array.isArray(data.posters) && data.posters.length > 0) {
          setPosters(data.posters);
        }
      } catch {
        /* hero continua sem fundo */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => splitIntoRows(posters, ROW_COUNT), [posters]);

  if (posters.length === 0) return null;

  return (
    <div
      className="landing-flow pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="landing-flow__vignette" />
      <div className="landing-flow__stack-outer">
        {rows.map((rowPosters, i) => (
          <HorizontalMarquee
            key={i}
            posters={rowPosters}
            reverse={i % 2 === 1}
            durationSec={38 + i * 9 + (i % 3) * 4}
            rowIndex={i}
          />
        ))}
      </div>
    </div>
  );
}
