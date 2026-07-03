export interface RoomParticipant {
  hyperbeamUserId: string;
  displayName: string;
  appUserId: number | null;
  hasControl: boolean;
  joinedAt: number;
}

export interface StoredRoom {
  roomKey: string;
  sessionId: string;
  embedUrl: string;
  adminToken: string;
  hostAppUserId: number;
  hostHyperbeamUserId: string | null;
  invitePath: string;
  participants: Map<string, RoomParticipant>;
  createdAt: number;
}

const globalRooms = globalThis as unknown as {
  __hbRooms?: Map<string, StoredRoom>;
};

const rooms: Map<string, StoredRoom> = globalRooms.__hbRooms ?? new Map();
if (!globalRooms.__hbRooms) globalRooms.__hbRooms = rooms;

export const DEFAULT_ROOM_KEY = 'openstream-lounge';

export function getRoom(roomKey: string): StoredRoom | undefined {
  return rooms.get(roomKey);
}

export function setRoom(room: StoredRoom): void {
  rooms.set(room.roomKey, room);
}

export function deleteRoom(roomKey: string): void {
  rooms.delete(roomKey);
}

export function listAllRooms(): StoredRoom[] {
  return Array.from(rooms.values());
}

/** Sessões em memória ficam obsoletas após restart da VM ou timeout no Hyperbeam. */
export function isRoomStale(room: StoredRoom, maxAgeMs = 3 * 60 * 60 * 1000): boolean {
  return Date.now() - room.createdAt > maxAgeMs;
}

export function listParticipants(room: StoredRoom): RoomParticipant[] {
  return Array.from(room.participants.values()).sort((a, b) => a.joinedAt - b.joinedAt);
}

export function upsertParticipant(
  room: StoredRoom,
  hyperbeamUserId: string,
  displayName: string,
  appUserId: number | null
): RoomParticipant {
  const existing = room.participants.get(hyperbeamUserId);
  if (existing) {
    existing.displayName = displayName;
    if (appUserId != null) existing.appUserId = appUserId;
    return existing;
  }
  const p: RoomParticipant = {
    hyperbeamUserId,
    displayName,
    appUserId,
    hasControl: false,
    joinedAt: Date.now(),
  };
  room.participants.set(hyperbeamUserId, p);
  return p;
}

export function removeParticipant(room: StoredRoom, hyperbeamUserId: string): void {
  room.participants.delete(hyperbeamUserId);
}

export function setParticipantControl(
  room: StoredRoom,
  hyperbeamUserId: string,
  hasControl: boolean
): void {
  for (const p of room.participants.values()) {
    p.hasControl = p.hyperbeamUserId === hyperbeamUserId && hasControl;
  }
}
