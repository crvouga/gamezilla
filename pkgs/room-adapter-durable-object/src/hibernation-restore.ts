import { Assert } from '@pkgs/assert';

import type {
  RoomCommandPayload,
  RoomEvent,
  RoomModuleName,
  RoomState,
} from '@pkgs/room';
import type { RoomServer } from '@pkgs/room/server';
import type { ResolvedAdapterConfig } from './adapter-base-types';
import {
  type RoomSocketAttachment,
  readRoomSocketAttachment,
} from './socket-attachment';
import type { DurableObjectInstanceState } from './types';

const crash: Assert = Assert.crash();

/** RFC 6455 §7.4: 1011 — unexpected condition (lost routing after hibernation). */
export const WS_CLOSE_SESSION_LOST = 1011;

export type WsMeta<Identity> = {
  readonly id: string;
  readonly identity: Identity;
  readonly clientId: string;
  readonly identityRaw: string;
  readonly moduleName: RoomModuleName;
  readonly topic: string;
  readonly traceparent: string | null;
};

type RestoreDeps<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
  Env,
> = {
  ctx: DurableObjectInstanceState;
  config: ResolvedAdapterConfig<S, C, E, Identity, Env>;
  servers: Map<RoomModuleName, RoomServer<S, C, E, Identity>>;
  wsMeta: WeakMap<WebSocket, WsMeta<Identity>>;
  createServerLocked: (
    topic: string,
    moduleName: RoomModuleName
  ) => Promise<RoomServer<S, C, E, Identity>>;
  sendJson: (ws: WebSocket, payload: unknown) => void;
};

/**
 * Re-registers one hibernated socket into in-memory routing. Closes the
 * socket when the attachment is missing or the identity no longer parses.
 */
export async function restoreOneSocket<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
  Env,
>(deps: RestoreDeps<S, C, E, Identity, Env>, ws: WebSocket): Promise<void> {
  const attachment = readRoomSocketAttachment(ws);
  if (attachment === null) {
    ws.close(WS_CLOSE_SESSION_LOST, 'missing socket attachment');
    return;
  }
  const identity = deps.config.parseIdentity(attachment.identityRaw);
  if (identity === null) {
    ws.close(WS_CLOSE_SESSION_LOST, 'unparseable identity after hibernation');
    return;
  }
  await attachRestoredSocket(deps, ws, attachment, identity);
}

async function attachRestoredSocket<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
  Env,
>(
  deps: RestoreDeps<S, C, E, Identity, Env>,
  ws: WebSocket,
  attachment: RoomSocketAttachment,
  identity: Identity
): Promise<void> {
  const { connId, clientId, moduleName, topic, identityRaw } = attachment;
  const server = await deps.createServerLocked(topic, moduleName);
  crash.ok(
    server.topic === topic,
    'RoomServer topic drifted while restoring hibernated socket',
    { existing: server.topic, requested: topic, moduleName }
  );
  deps.wsMeta.set(ws, {
    id: connId,
    identity,
    identityRaw,
    clientId,
    moduleName,
    topic,
    traceparent: attachment.traceparent,
  });
  if (!server.hasConnection(connId)) {
    // Suppress per-connection roster broadcasts during restore; the caller
    // emits a single snapshot once every socket is re-attached.
    server.registerConnection(
      connId,
      (msg) => deps.sendJson(ws, msg),
      { id: identityRaw, clientId },
      { silent: true, grants: attachment.grants }
    );
  }
}

/**
 * One-shot rebuild of `wsMeta` + `RoomServer` connections after DO eviction.
 * Hibernatable sockets stay connected on the Cloudflare edge; only
 * in-memory routing is lost — this walks `ctx.getWebSockets()` and
 * re-attaches each one from its serialized attachment, then broadcasts
 * one roster snapshot so clients converge.
 */
export async function restoreHibernatedSockets<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
  Env,
>(deps: RestoreDeps<S, C, E, Identity, Env>): Promise<void> {
  const sockets = deps.ctx.getWebSockets();
  for (const ws of sockets) {
    await restoreOneSocket(deps, ws);
  }
  const seen = new Set<RoomServer<S, C, E, Identity>>();
  for (const server of deps.servers.values()) {
    if (seen.has(server)) continue;
    seen.add(server);
    server.broadcastRoster();
  }
}
