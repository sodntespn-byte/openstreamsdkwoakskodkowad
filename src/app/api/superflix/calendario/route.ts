import { NextResponse } from 'next/server';
import { fetchSuperflixCalendar } from '@/lib/superflixFetch';

export async function GET() {
  try {
    const episodes = await fetchSuperflixCalendar();
    if (!episodes) {
      return NextResponse.json(
        { error: 'Não foi possível obter o calendário da SuperFlixAPI.' },
        { status: 502 }
      );
    }

    return NextResponse.json(episodes, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro no calendário';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
