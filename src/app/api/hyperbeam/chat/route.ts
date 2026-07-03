import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { FEATURES } from '@/lib/features';
import {
  addChatMessage,
  getChatSince,
  getParty,
  resolvePartyId,
  touchMember,
  upsertMember,
} from '@/lib/hyperbeamPartyStore';

function featureDisabled() {
  return NextResponse.json({ error: 'Sala VM desativada' }, { status: 404 });
}

export async function GET(request: NextRequest) {
  if (!FEATURES.hyperbeam) return featureDisabled();

  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const partyId = resolvePartyId(
    request.nextUrl.searchParams.get('party'),
    request.nextUrl.searchParams.get('room')
  );
  if (!partyId) {
    return NextResponse.json({ messages: [] });
  }

  const party = getParty(partyId);
  if (!party) {
    return NextResponse.json({ messages: [], notFound: true });
  }

  const since = Number(request.nextUrl.searchParams.get('since') || 0);
  touchMember(party, user.userId);

  return NextResponse.json({
    messages: since > 0 ? getChatSince(party, since) : party.chat.slice(-80),
    partyId: party.partyId,
    title: party.title,
  });
}

export async function POST(request: NextRequest) {
  if (!FEATURES.hyperbeam) return featureDisabled();

  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    partyId?: string;
    roomKey?: string;
    text?: string;
  };

  const partyId = resolvePartyId(body.partyId, body.roomKey);
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!partyId) {
    return NextResponse.json({ error: 'partyId obrigatório' }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
  }

  const party = getParty(partyId);
  if (!party) {
    return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 });
  }

  const name = user.email.split('@')[0] || 'Utilizador';
  upsertMember(party, user.userId, name);
  const message = addChatMessage(party, user.userId, name, text);

  return NextResponse.json({ message });
}
