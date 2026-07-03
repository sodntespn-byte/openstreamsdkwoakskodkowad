import { randomBytes } from 'crypto';

export interface PartyMember {
  appUserId: number;
  displayName: string;
  joinedAt: number;
  lastSeen: number;
  hasVm: boolean;
}

export interface UserVmSession {
  sessionId: string;
  embedUrl: string;
  adminToken: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  appUserId: number;
  displayName: string;
  text: string;
  createdAt: number;
}

export interface Party {
  partyId: string;
  hostAppUserId: number;
  title: string;
  startUrl?: string;
  invitePath: string;
  members: Map<number, PartyMember>;
  userVms: Map<number, UserVmSession>;
  chat: ChatMessage[];
  createdAt: number;
}

const globalParties = globalThis as unknown as {
  __hbParties?: Map<string, Party>;
};

const parties: Map<string, Party> = globalParties.__hbParties ?? new Map();
if (!globalParties.__hbParties) globalParties.__hbParties = parties;

const PARTY_ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
const MAX_CHAT = 200;

export function generatePartyId(): string {
  const bytes = randomBytes(8);
  let id = '';
  for (let i = 0; i < 8; i++) id += PARTY_ID_CHARS[bytes[i]! % PARTY_ID_CHARS.length];
  return id;
}

export function getParty(partyId: string): Party | undefined {
  return parties.get(partyId);
}

export function setParty(party: Party): void {
  parties.set(party.partyId, party);
}

export function deleteParty(partyId: string): void {
  parties.delete(partyId);
}

export function listAllParties(): Party[] {
  return Array.from(parties.values());
}

export function createParty(hostAppUserId: number, title: string, startUrl?: string): Party {
  let partyId = generatePartyId();
  for (let i = 0; i < 5 && parties.has(partyId); i++) {
    partyId = generatePartyId();
  }
  const party: Party = {
    partyId,
    hostAppUserId,
    title: title.slice(0, 120) || 'Sessão de visionamento',
    startUrl,
    invitePath: `/sala?party=${partyId}`,
    members: new Map(),
    userVms: new Map(),
    chat: [],
    createdAt: Date.now(),
  };
  setParty(party);
  return party;
}

export function upsertMember(
  party: Party,
  appUserId: number,
  displayName: string
): PartyMember {
  const existing = party.members.get(appUserId);
  const now = Date.now();
  if (existing) {
    existing.displayName = displayName;
    existing.lastSeen = now;
    existing.hasVm = party.userVms.has(appUserId);
    return existing;
  }
  const m: PartyMember = {
    appUserId,
    displayName,
    joinedAt: now,
    lastSeen: now,
    hasVm: false,
  };
  party.members.set(appUserId, m);
  return m;
}

export function touchMember(party: Party, appUserId: number): void {
  const m = party.members.get(appUserId);
  if (m) {
    m.lastSeen = Date.now();
    m.hasVm = party.userVms.has(appUserId);
  }
}

export function listMembers(party: Party): PartyMember[] {
  const now = Date.now();
  return Array.from(party.members.values())
    .map((m) => ({
      ...m,
      online: now - m.lastSeen < 45_000,
      hasVm: party.userVms.has(m.appUserId),
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

export function addChatMessage(
  party: Party,
  appUserId: number,
  displayName: string,
  text: string
): ChatMessage {
  const msg: ChatMessage = {
    id: `${Date.now()}-${randomBytes(4).toString('hex')}`,
    appUserId,
    displayName,
    text: text.slice(0, 2000),
    createdAt: Date.now(),
  };
  party.chat.push(msg);
  if (party.chat.length > MAX_CHAT) {
    party.chat.splice(0, party.chat.length - MAX_CHAT);
  }
  return msg;
}

export function getChatSince(party: Party, since: number): ChatMessage[] {
  return party.chat.filter((m) => m.createdAt > since);
}

export function isVmStale(vm: UserVmSession, maxAgeMs = 3 * 60 * 60 * 1000): boolean {
  return Date.now() - vm.createdAt > maxAgeMs;
}

export function resolvePartyId(
  partyParam: string | null | undefined,
  roomParam?: string | null
): string | undefined {
  const raw = (partyParam || roomParam || '').trim().toLowerCase();
  if (!raw || raw === 'openstream-lounge') return undefined;
  return raw.slice(0, 32);
}
