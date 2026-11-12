/**
 * What a run writes into a server that outlives it. A world on its own
 * server starts empty, so the ids and names a scenario mints there are its
 * own. A localhost stack serves every scenario of a run from one database:
 * the ids and names a fixture mints there carry the run's tag, as an
 * actor's Google address does (`actorEmail`), so no two scenarios mint the
 * same row id or claim the same username.
 */
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { ProductHarness } from './harness';
import { productExtra } from './harness';
import { ACTOR_IDS } from './parameter-types';

/** The run's tag on a shared stack, or `null` on a server of the world's own. */
export function runTag(s: ProductHarness): string | null {
  const http = productExtra(s).http;
  return http.kind === 'stack' ? http.accountTag : null;
}

/**
 * Ids carrying `tag` in their first group: still a UUID's shape, never one
 * another tag's run mints. Without a tag, `createId` as it is.
 */
export function taggedCreateId(
  createId: CreateId,
  tag: string | null
): CreateId {
  if (tag === null) return createId;
  if (!/^[0-9a-f]{8}$/.test(tag))
    throw new Error(`A run tag is eight hex digits, not ${tag}`);
  return () => `${tag}${createId().slice(8)}`;
}

/** A name a scenario claims, unique to the run on a shared server. */
export function taggedUsername(name: string, tag: string | null): string {
  return tag === null ? name : `${name}_${tag}`;
}

const ACTOR_USERNAMES: ReadonlySet<string> = new Set(Object.values(ACTOR_IDS));

/**
 * The username `name` stands for in `tag`'s run: an actor's own name (`alice`
 * is Alice's username) carries the tag on a shared server, so it names this
 * scenario's Alice and not one an earlier scenario left behind. Any other
 * name, and a name that already carries the tag, is the name as typed.
 */
export function taggedActorUsername(name: string, tag: string | null): string {
  return ACTOR_USERNAMES.has(name) ? taggedUsername(name, tag) : name;
}

/** The username `name` stands for in this run (see {@link taggedActorUsername}). */
export function actorUsername(s: ProductHarness, name: string): string {
  return taggedActorUsername(name, runTag(s));
}

/** Ids for rows a fixture writes into the server, unique to this run. */
export function runScopedCreateId(s: ProductHarness): CreateId {
  return taggedCreateId(s.session.ports.createId, runTag(s));
}

/** The username the actor claims, unique to this run. */
export function runScopedUsername(s: ProductHarness, actorId: string): string {
  return taggedUsername(actorId, runTag(s));
}
