import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { FEATURES } from '@/lib/features';
import { hyperbeamAddRoles } from '@/lib/hyperbeam';
import { getParty, resolvePartyId } from '@/lib/hyperbeamPartyStore';

function featureDisabled() {
  return NextResponse.json({ error: 'Sala VM desativada' }, { status: 404 });
}

/** Ativa rato/teclado no PC virtual do próprio utilizador. */
export async function POST(request: NextRequest) {
  if (!FEATURES.hyperbeam) return featureDisabled();

  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const partyId = resolvePartyId(body.partyId, body.roomKey);
  const targetId =
    typeof body.targetHyperbeamUserId === 'string' ? body.targetHyperbeamUserId : '';
  const action = body.action as string;

  if (!partyId || action !== 'grant_self') {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
  }
  if (!targetId) {
    return NextResponse.json({ error: 'targetHyperbeamUserId obrigatório' }, { status: 400 });
  }

  const party = getParty(partyId);
  if (!party) {
    return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 });
  }

  const vm = party.userVms.get(user.userId);
  if (!vm) {
    return NextResponse.json({ error: 'PC virtual inativo' }, { status: 404 });
  }

  try {
    await hyperbeamAddRoles(
      vm.embedUrl,
      vm.adminToken,
      [targetId],
      ['control', 'cursor_data', 'clipboard_copy'],
      false
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao ativar controlo';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
