import { parseRoomModuleName } from '@pkgs/room-shared/types';
import type { RoomModuleName } from '@pkgs/room-shared/types';

/**
 * Per-WebSocket metadata persisted via the Hibernation WebSocket API
 * (`serializeAttachment` / `deserializeAttachment`) so routing survives DO
 * eviction. Must stay under the 16 KiB structured-clone size limit.
 */
export type RoomSocketAttachment = {
  readonly connId: string;
  readonly identityRaw: string;
  /** Per-tab / per-app-instance id; falls back to connId when absent on legacy. */
  readonly clientId: string;
  readonly moduleName: RoomModuleName;
  readonly topic: string;
  /** OTel connection context; null when application export is disabled. */
  readonly traceparent: string | null;
  /** Grants the gateway admitted the connection with; none on legacy. */
  readonly grants: readonly string[];
};

/**
 * Workers-only methods on hibernatable WebSockets. Absent from the DOM
 * `WebSocket` lib used by the web build, so we cast structurally.
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

function readNonEmptyString(
  raw: Record<string, unknown>,
  key: string
): string | null {
  const value = raw[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function resolveAttachmentClientId(
  raw: Record<string, unknown>,
  connId: string
): string {
  // Legacy attachments (pre-clientId) fall back to connId so hibernated
  // sockets still rebuild a usable roster after deploy.
  const clientIdRaw = raw['clientId'];
  return typeof clientIdRaw === 'string' && clientIdRaw.length > 0
    ? clientIdRaw
    : connId;
}

function readGrants(raw: Record<string, unknown>): readonly string[] {
  const grants = raw['grants'];
  if (!Array.isArray(grants)) return [];
  return grants.filter((g): g is string => typeof g === 'string');
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
  const connId = readNonEmptyString(raw, 'connId');
  const identityRaw = readNonEmptyString(raw, 'identityRaw');
  const topic = readNonEmptyString(raw, 'topic');
  const moduleNameRaw = raw['moduleName'];
  const traceparentRaw = raw['traceparent'];
  if (connId === null || identityRaw === null || topic === null) return null;
  if (typeof moduleNameRaw !== 'string') return null;
  if (traceparentRaw !== null && typeof traceparentRaw !== 'string')
    return null;
  const moduleName = parseRoomModuleName(moduleNameRaw);
  if (moduleName === null) return null;
  return {
    connId,
    identityRaw,
    clientId: resolveAttachmentClientId(raw, connId),
    moduleName,
    topic,
    traceparent: traceparentRaw,
    grants: readGrants(raw),
  };
}
