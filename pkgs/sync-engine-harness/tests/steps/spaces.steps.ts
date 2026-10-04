/**
 * Shared spaces: being in one, leaving and rejoining. A person's devices in
 * these scenarios hydrate their space memberships, so leaving stops notes.
 */

import {
  createSpace,
  endSpace,
  joinSpace,
  leaveSpace,
} from '@pkgs/sync-engine-harness/membership-mutations';
import { notesDeniedQuery } from '@pkgs/sync-engine-harness/queries';
import { hasTopic, lacksTopic } from '@pkgs/sync-engine-harness/reads';
import {
  mutate,
  nudge,
  subscribe,
  unsubscribe,
} from '@pkgs/sync-engine-harness/regression-actions';
import { subscribedTopics } from '@pkgs/sync-engine-harness/sync-observations';
import { roomTopic } from '@pkgs/sync-engine-harness/topics';
import { SETTLE_MS } from './note-writes';
import type { SyncWorld } from './world';
import { app, ensureDevice, Given, When } from './world';

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
    w.hostOf.set(space, host);
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

/** Only the person who started a shared space can end it. */
When('the shared space {string} ends', async (w, space: string) => {
  const host = w.hostOf.get(space);
  if (host === undefined) throw new Error(`nobody started "${space}"`);
  await w.s.apply(mutate, host, endSpace, { spaceId: space });
});

/**
 * Opening a shared space the person is not in asks for notes the server
 * refuses them (the denied query); the space's name picks nothing else.
 */
async function openNotIn(w: SyncWorld, actor: string): Promise<void> {
  const id = await ensureDevice(w, app(actor), true);
  await w.s.apply(subscribe, id, notesDeniedQuery.name, {});
}

When(
  '{actor} opens the shared space {string}, which they are not in',
  (w, actor: string, _space: string) => openNotIn(w, actor)
);

Given(
  '{actor} has opened the shared space {string}, which they are not in',
  (w, actor: string, _space: string) => openNotIn(w, actor)
);

When(
  '{actor} closes the shared space {string} and their app catches up',
  async (w, actor: string, _space: string) => {
    const id = await ensureDevice(w, app(actor), true);
    await w.s.apply(unsubscribe, id, notesDeniedQuery.name);
    await w.s.apply(nudge, id);
  }
);
