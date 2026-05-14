import { NextRequest, NextResponse } from 'next/server';
import { extractImdbRating, fetchImdb236Document, pickImdbSummary } from '@/lib/imdb236';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id || id.length > 32) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const raw = await fetchImdb236Document(id);
  if (!raw) {
    return NextResponse.json(
      { error: 'Sem dados IMDb ou RAPIDAPI_KEY não configurada', rating: null, raw: null },
      { status: 200 }
    );
  }

  const rating = extractImdbRating(raw);
  const summary = pickImdbSummary(raw);

  return NextResponse.json({
    rating,
    summary,
    raw,
  });
}
