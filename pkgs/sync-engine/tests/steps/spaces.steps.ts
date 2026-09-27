/**
 * Shared spaces: being in one, leaving and rejoining. A person's devices in
 * these scenarios hydrate their space memberships, so leaving stops notes.
 */

import {
  createSpace,
  hasTopic,
  joinSpace,
  lacksTopic,
  leaveSpace,
  mutate,
  roomTopic,
  subscribedTopics,
} from '@pkgs/sync-engine/sim';
import { SETTLE_MS } from './note-writes';
import { app, ensureDevice, Given, type SyncWorld, When } from './world';

async function subscribed(
  w: SyncWorld,
  actor: string,
  space: string,
  inside: boolean
) {
  await w.s.until((s) => subscribedTopics(s, actor), {
    maxMs: SETTLE_MS,
    pred: inside ? hasTopic(roomTopic(space)) : lacksTopic(roomTopic(space)),
  });
}

async function join(w: SyncWorld, actor: string, space: string) {
  const id = await ensureDevice(w, app(actor), true);
  await w.s.apply(mutate, id, joinSpace, { spaceId: space });
  w.spaceOf.set(actor, space);
}

async function leave(w: SyncWorld, actor: string, space: string) {
  const id = await ensureDevice(w, app(actor), true);
  await w.s.apply(mutate, id, leaveSpace, { spaceId: space });
  w.spaceOf.delete(actor);
}

Given(
  '{actor} and {actor} are in the shared space {string}',
  async (w, host: string, guest: string, space: string) => {
    const hostId = await ensureDevice(w, app(host), true);
    await ensureDevice(w, app(guest), true);
    await w.s.apply(mutate, hostId, createSpace, { id: space, title: space });
    w.spaceOf.set(host, space);
    await subscribed(w, host, space, true);
    await join(w, guest, space);
    await subscribed(w, guest, space, true);
  }
);

Given(
  '{actor} has left the shared space {string}',
  async (w, actor: string, space: string) => {
    await leave(w, actor, space);
    await subscribed(w, actor, space, false);
  }
);

When(
  '{actor} joins the shared space {string}',
  (w, actor: string, space: string) => join(w, actor, space)
);

When(
  '{actor} leaves the shared space {string}',
  (w, actor: string, space: string) => leave(w, actor, space)
);
