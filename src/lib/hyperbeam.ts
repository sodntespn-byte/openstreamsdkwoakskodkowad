import { deleteParty, listAllParties } from '@/lib/hyperbeamPartyStore';

const VM_API = 'https://engine.hyperbeam.com/v0/vm';

export interface HyperbeamSession {
  session_id: string;
  embed_url: string;
  admin_token: string;
}

function apiKey(): string {
  const key = process.env.HYPERBEAM_API_KEY?.trim();
  if (!key) {
    throw new Error('HYPERBEAM_API_KEY não está definida no servidor');
  }
  return key;
}

/** O SDK do browser faz fetch a este URL; se a sessão morreu, o import(blob) falha. */
export async function isEmbedReachable(embedUrl: string): Promise<boolean> {
  try {
    const u = new URL(embedUrl);
    u.searchParams.set('no_cbor', '1');
    const res = await fetch(u.toString(), {
      method: 'GET',
      headers: { Accept: '*/*' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status >= 400) return false;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) return false;
    return true;
  } catch {
    return false;
  }
}

export async function purgeAllPartyVms(
  terminate: (sessionId: string) => Promise<void>
): Promise<number> {
  let count = 0;
  for (const party of listAllParties()) {
    for (const vm of party.userVms.values()) {
      try {
        await terminate(vm.sessionId);
        count++;
      } catch {
        /* sessão já encerrada */
      }
    }
    deleteParty(party.partyId);
  }
  return count;
}

export function sessionApiBase(embedUrl: string): string {
  const u = new URL(embedUrl);
  u.search = '';
  return u.href.replace(/\/$/, '');
}

export async function createHyperbeamSession(options?: {
  tag?: string;
  startUrl?: string;
  /** Visitantes só veem até receberem o role `control`. */
  controlDisableDefault?: boolean;
}): Promise<HyperbeamSession> {
  const body: Record<string, unknown> = {
    /** false = qualquer pessoa na sala pode usar rato/teclado (mais simples para ver e usar). */
    control_disable_default: options?.controlDisableDefault ?? false,
    default_roles: ['control', 'cursor_data', 'clipboard_copy'],
  };
  if (options?.tag) body.tag = options.tag;
  if (options?.startUrl) body.start_url = options.startUrl;

  const res = await fetch(VM_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as HyperbeamSession & { message?: string };
  if (!res.ok) {
    throw new Error(data.message || `Hyperbeam: HTTP ${res.status}`);
  }
  return data;
}

export async function terminateHyperbeamSession(sessionId: string): Promise<void> {
  const res = await fetch(`${VM_API}/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok && res.status !== 404) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || `Hyperbeam: HTTP ${res.status}`);
  }
}

export async function hyperbeamAddRoles(
  embedUrl: string,
  adminToken: string,
  userIds: string[],
  roles: string[],
  exclusive = false
): Promise<void> {
  const base = sessionApiBase(embedUrl);
  const res = await fetch(`${base}/addRoles`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([userIds, roles, exclusive]),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `addRoles: HTTP ${res.status}`);
  }
}

export async function hyperbeamRemoveRoles(
  embedUrl: string,
  adminToken: string,
  userIds: string[],
  roles: string[],
  exclusive = false
): Promise<void> {
  const base = sessionApiBase(embedUrl);
  const res = await fetch(`${base}/removeRoles`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([userIds, roles, exclusive]),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `removeRoles: HTTP ${res.status}`);
  }
}
