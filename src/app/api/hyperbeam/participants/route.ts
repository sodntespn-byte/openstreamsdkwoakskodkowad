import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { FEATURES } from '@/lib/features';
import {
  getParty,
  listMembers,
  resolvePartyId,
  touchMember,
  upsertMember,
} from '@/lib/hyperbeamPartyStore';

function featureDisabled() {
  return NextResponse.json({ error: 'Sala VM desativada' }, { status: 404 });
}

/** Lista membros da sala + heartbeat de presença. */
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
    return NextResponse.json({ members: [], hostAppUserId: null });
  }

  const party = getParty(partyId);
  if (!party) {
    return NextResponse.json({ members: [], hostAppUserId: null, notFound: true });
  }

  if (user) {
    const name = user.email.split('@')[0] || 'Utilizador';
    upsertMember(party, user.userId, name);
    touchMember(party, user.userId);
  }

  return NextResponse.json({
    partyId: party.partyId,
    title: party.title,
    hostAppUserId: party.hostAppUserId,
    invitePath: party.invitePath,
    members: listMembers(party),
  });
}

export async function POST(request: NextRequest) {
  if (!FEATURES.hyperbeam) return featureDisabled();

  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const partyId = resolvePartyId(body.partyId, body.roomKey);
  if (!partyId) {
    return NextResponse.json({ error: 'partyId obrigatório' }, { status: 400 });
  }

  const party = getParty(partyId);
  if (!party) {
    return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 });
  }

  const displayName =
    typeof body.displayName === 'string'
      ? body.displayName.trim().slice(0, 80)
      : user.email.split('@')[0];

  const member = upsertMember(party, user.userId, displayName || 'Utilizador');
  return NextResponse.json({ member });
}
