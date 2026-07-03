import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { FEATURES } from '@/lib/features';
import {
  createHyperbeamSession,
  terminateHyperbeamSession,
  isEmbedReachable,
  purgeAllPartyVms,
} from '@/lib/hyperbeam';
import {
  createParty,
  deleteParty,
  getParty,
  isVmStale,
  resolvePartyId,
  setParty,
  touchMember,
  upsertMember,
  type Party,
  type UserVmSession,
} from '@/lib/hyperbeamPartyStore';

function featureDisabled() {
  return NextResponse.json({ error: 'Sala VM desativada' }, { status: 404 });
}

function displayName(user: { email: string }): string {
  return user.email.split('@')[0] || 'Utilizador';
}

async function discardUserVm(party: Party, appUserId: number): Promise<void> {
  const vm = party.userVms.get(appUserId);
  if (!vm) return;
  try {
    await terminateHyperbeamSession(vm.sessionId);
  } catch {
    /* já encerrada */
  }
  party.userVms.delete(appUserId);
  const m = party.members.get(appUserId);
  if (m) m.hasVm = false;
}

async function vmNeedsRefresh(vm: UserVmSession): Promise<boolean> {
  if (isVmStale(vm)) return true;
  return !(await isEmbedReachable(vm.embedUrl));
}

async function createUserVm(
  party: Party,
  appUserId: number,
  startUrl?: string
): Promise<UserVmSession> {
  let session;
  const tag = `${party.partyId}-u${appUserId}`;
  try {
    session = await createHyperbeamSession({
      tag,
      startUrl: startUrl || party.startUrl,
      controlDisableDefault: false,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (/exceeded|vm.?limit|concurrent/i.test(msg)) {
      await purgeAllPartyVms(terminateHyperbeamSession);
      session = await createHyperbeamSession({
        tag,
        startUrl: startUrl || party.startUrl,
        controlDisableDefault: false,
      });
    } else {
      throw e;
    }
  }
  return {
    sessionId: session.session_id,
    embedUrl: session.embed_url,
    adminToken: session.admin_token,
    createdAt: Date.now(),
  };
}

function sessionPayload(
  party: Party,
  userId: number,
  vm: UserVmSession,
  opts: { createdParty: boolean; createdVm: boolean }
) {
  return {
    partyId: party.partyId,
    title: party.title,
    invitePath: party.invitePath,
    inviteCode: party.partyId,
    embedUrl: vm.embedUrl,
    adminToken: vm.adminToken,
    isHost: party.hostAppUserId === userId,
    createdParty: opts.createdParty,
    createdVm: opts.createdVm,
    startUrl: party.startUrl,
  };
}

/** Entrar numa sala (cada utilizador recebe o seu PC virtual). */
export async function POST(request: NextRequest) {
  if (!FEATURES.hyperbeam) return featureDisabled();

  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Inicie sessão para entrar na sala' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      partyId?: string;
      roomKey?: string;
      createParty?: boolean;
      title?: string;
      startUrl?: string;
      forceNew?: boolean;
    };

    const startUrl =
      typeof body.startUrl === 'string' && body.startUrl.startsWith('http')
        ? body.startUrl
        : undefined;

    let createdParty = false;
    let party: Party;

    if (body.createParty === true) {
      party = createParty(
        user.userId,
        typeof body.title === 'string' ? body.title : 'Ver juntos',
        startUrl
      );
      createdParty = true;
    } else {
      const partyId = resolvePartyId(body.partyId, body.roomKey);
      if (!partyId) {
        return NextResponse.json(
          { error: 'Usa um link de convite válido ou cria uma sala nova.' },
          { status: 400 }
        );
      }
      const existing = getParty(partyId);
      if (!existing) {
        return NextResponse.json(
          { error: 'Sala não encontrada. O link pode ter expirado — peça um novo convite.' },
          { status: 404 }
        );
      }
      party = existing;
    }

    const name = displayName(user);
    upsertMember(party, user.userId, name);

    let vm = party.userVms.get(user.userId);
    let createdVm = false;
    const forceNew = body.forceNew === true;

    if (vm && (forceNew || (await vmNeedsRefresh(vm)))) {
      await discardUserVm(party, user.userId);
      vm = undefined;
    }

    if (!vm) {
      vm = await createUserVm(party, user.userId, startUrl);
      party.userVms.set(user.userId, vm);
      const m = party.members.get(user.userId);
      if (m) m.hasVm = true;
      createdVm = true;
    }

    if (startUrl && party.hostAppUserId === user.userId) {
      party.startUrl = startUrl;
    }

    setParty(party);

    return NextResponse.json(
      sessionPayload(party, user.userId, vm, { createdParty, createdVm })
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao criar sessão';
    const friendly = /exceeded|vm.?limit|concurrent/i.test(msg)
      ? 'Limite de PCs virtuais no Hyperbeam. Feche VMs antigas no painel Hyperbeam ou aguarde.'
      : msg;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
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
    return NextResponse.json({ active: false });
  }

  const party = getParty(partyId);
  if (!party) {
    return NextResponse.json({ active: false, partyId, notFound: true });
  }

  touchMember(party, user.userId);
  const vm = party.userVms.get(user.userId);

  if (vm && (await vmNeedsRefresh(vm))) {
    await discardUserVm(party, user.userId);
    setParty(party);
    return NextResponse.json({
      active: true,
      partyId: party.partyId,
      title: party.title,
      invitePath: party.invitePath,
      hasVm: false,
      needsJoin: true,
    });
  }

  return NextResponse.json({
    active: true,
    partyId: party.partyId,
    title: party.title,
    invitePath: party.invitePath,
    hasVm: Boolean(vm),
    embedUrl: vm?.embedUrl,
    adminToken: vm?.adminToken,
    isHost: party.hostAppUserId === user.userId,
  });
}

/** Encerrar o PC do utilizador ou a sala inteira (anfitrião). */
export async function DELETE(request: NextRequest) {
  if (!FEATURES.hyperbeam) return featureDisabled();

  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const partyId = resolvePartyId(
    request.nextUrl.searchParams.get('party'),
    request.nextUrl.searchParams.get('room')
  );
  const endAll = request.nextUrl.searchParams.get('all') === '1';

  if (!partyId) {
    return NextResponse.json({ success: true });
  }

  const party = getParty(partyId);
  if (!party) {
    return NextResponse.json({ success: true });
  }

  try {
    if (endAll && party.hostAppUserId === user.userId) {
      for (const vm of party.userVms.values()) {
        try {
          await terminateHyperbeamSession(vm.sessionId);
        } catch {
          /* ignore */
        }
      }
      deleteParty(partyId);
    } else {
      await discardUserVm(party, user.userId);
      setParty(party);
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erro ao encerrar';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
