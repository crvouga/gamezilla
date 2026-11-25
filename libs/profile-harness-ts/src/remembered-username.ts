import { taggedUsername } from '@libs/harness-ts/run-scope';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';

/** Where a scenario keeps the username an actor renamed themselves to. */
export function usernameKey(actor: string): string {
  return `username:${actor}`;
}

/** The username `actor` renamed themselves to, or their own name. */
export function rememberedUsername(w: HarnessWorld, actor: string): string {
  const name = w.memo.get(usernameKey(actor));
  return typeof name === 'string' ? name : actor;
}

/** The concrete username a named fixture represents in this scenario. */
export function fixtureUsername(
  w: Pick<HarnessWorld, 'memo'>,
  name: string
): string {
  const suffix = w.memo.get(`username-suffix:${name.toLowerCase()}`);
  return typeof suffix === 'string' ? name + suffix : name;
}

/** An existing username is unique to a shared database run. Once a name is
 * chosen in this world, another person claiming it must use that same name.
 */
export function claimFixtureUsername(
  w: Pick<HarnessWorld, 'memo'>,
  name: string,
  tag: string | null
): string {
  const key = `username-suffix:${name.toLowerCase()}`;
  if (!w.memo.has(key))
    w.memo.set(key, taggedUsername(name, tag).slice(name.length));
  return fixtureUsername(w, name);
}
