import { parseRoomModuleName, type RoomModuleName } from '../../../types';

/**
 * Per-WebSocket metadata persisted via the Hibernation WebSocket API
 * (`serializeAttachment` / `deserializeAttachment`) so routing survives DO
 * eviction. Must stay under the 16 KiB structured-clone size limit.
 */
export type RoomSocketAttachment = {
  readonly connId: string;
  readonly identityRaw: string;
  readonly moduleName: RoomModuleName;
  readonly topic: string;
};

/**
 * Workers-only methods on hibernatable WebSockets. Absent from the DOM
 * `WebSocket` lib used by the Expo web build, so we cast structurally.
 */
type HibernatableWebSocket = WebSocket & {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
};

function asHibernatable(ws: WebSocket): HibernatableWebSocket {
  return ws as HibernatableWebSocket;
}

export function writeRoomSocketAttachment(
  ws: WebSocket,
  attachment: RoomSocketAttachment
): void {
  asHibernatable(ws).serializeAttachment(attachment);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Reads and validates the attachment written at upgrade time.
 * Returns `null` when missing or malformed (caller should close the socket).
 */
export function readRoomSocketAttachment(
  ws: WebSocket
): RoomSocketAttachment | null {
  const raw = asHibernatable(ws).deserializeAttachment();
  if (!isRecord(raw)) return null;
  const connId = raw['connId'];
  const identityRaw = raw['identityRaw'];
  const moduleNameRaw = raw['moduleName'];
  const topic = raw['topic'];
  if (typeof connId !== 'string' || connId.length === 0) return null;
  if (typeof identityRaw !== 'string' || identityRaw.length === 0) return null;
  if (typeof topic !== 'string' || topic.length === 0) return null;
  if (typeof moduleNameRaw !== 'string') return null;
  const moduleName = parseRoomModuleName(moduleNameRaw);
  if (moduleName === null) return null;
  return { connId, identityRaw, moduleName, topic };
}
