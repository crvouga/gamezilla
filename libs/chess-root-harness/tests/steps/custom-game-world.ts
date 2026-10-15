import {
  establishCustomGame,
  openCustomGame,
} from '@libs/chess-custom-game-harness/custom-game-actions';
import { readCustomGameProbe } from '@libs/chess-custom-game-harness/custom-game-ui';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import type { CustomGameInput } from '@libs/game-session-shared/custom-game-choice';
import type { CustomGame } from '@libs/game-session-shared/custom-game-state';
import type { ProductHarness } from '@libs/harness/harness';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import {
  createSpace,
  joinViaLink,
  reopenSpaceLink,
} from '@libs/spaces-harness/space-actions';
import {
  activeSpaceVisible,
  readSpaceLink,
} from '@libs/spaces-harness/spaces-ui-reads';

type CustomWorld = Pick<HarnessWorld, 's' | 'memo'>;

export function customHost(w: CustomWorld): string {
  return String(
    w.memo.get('custom-host') ?? w.memo.get('spaceHost') ?? 'alice'
  );
}
/** The people this scenario put in the space. */
export function customMembers(w: CustomWorld): Set<string> {
  const members = w.memo.get('custom-members');
  if (members instanceof Set) return members as Set<string>;
  const created = new Set<string>();
  w.memo.set('custom-members', created);
  return created;
}
export function customPeople(w: CustomWorld): Map<string, string> {
  const people = w.memo.get('custom-people');
  if (people instanceof Map) return people as Map<string, string>;
  const created = new Map<string, string>();
  w.memo.set('custom-people', created);
  return created;
}

function onStage(s: ProductHarness, actor: string): boolean {
  return s.actors.has(actor);
}

/**
 * Someone a scenario has not met yet arrives with a named free account (guests,
 * free accounts and Plus members have the same Custom Games), so they can also
 * be found and blocked; a guest stays a guest.
 */
async function arrive(
  w: CustomWorld,
  actor: string,
  guest: boolean
): Promise<void> {
  if (!guest && !(await w.s.read(onStage, actor)))
    await prepareNamedFriend(w.s, actor);
  await w.s.apply(focusActor, actor);
}

export async function customSpace(
  w: CustomWorld,
  host = customHost(w),
  others: readonly string[] = [],
  options: { readonly guests?: boolean } = {}
): Promise<void> {
  await arrive(w, host, false);
  if (!(await w.s.read(activeSpaceVisible, host)))
    await w.s.apply(createSpace, host);
  const link = await w.s.read(readSpaceLink, host);
  if (link === null) throw new Error(`${host} has no space link`);
  w.memo.set('custom-host', host);
  w.memo.set('custom-link', link);
  w.memo.set('spaceHost', host);
  w.memo.set('spaceLink', link);
  await w.s.apply(openCustomGame, host);
  const hostProbe = await w.s.read(readCustomGameProbe, host);
  if (hostProbe === null) throw new Error(`${host} has no game screen`);
  customPeople(w).set(host, hostProbe.myId);
  customMembers(w).add(host);
  for (const other of others) {
    await arrive(w, other, options.guests === true);
    await w.s.apply(joinViaLink, other, link);
    await w.s.apply(openCustomGame, other);
    const probe = await w.s.read(readCustomGameProbe, other);
    if (probe === null) throw new Error(`${other} has no game screen`);
    customPeople(w).set(other, probe.myId);
    customMembers(w).add(other);
  }
}

export async function customFact(
  w: CustomWorld,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  await w.s.apply(establishCustomGame, actor, input);
  if (input.operation === 'create')
    w.memo.set('custom-created-id', (await customGame(w)).id);
}
export async function customGame(
  w: CustomWorld,
  actor?: string
): Promise<CustomGame> {
  const person = actor ?? customHost(w);
  await customScreen(w, person);
  const game = (await w.s.read(readCustomGameProbe, person))?.current;
  if (game === null || game === undefined)
    throw new Error(`${actor} sees no game`);
  return game;
}
export function customPerson(w: CustomWorld, actor: string): string {
  const id = customPeople(w).get(actor);
  if (id === undefined)
    throw new Error(`${actor} has no recorded member identity`);
  return id;
}

export async function customScreen(
  w: CustomWorld,
  actor: string
): Promise<void> {
  if ((await w.s.read(readCustomGameProbe, actor)) !== null) return;
  await w.s.apply(reopenSpaceLink, actor, String(w.memo.get('custom-link')));
  await w.s.apply(openCustomGame, actor);
}

export async function customDefault(
  w: CustomWorld,
  host: string
): Promise<void> {
  await customSpace(w, host, host === 'bob' ? ['alice'] : ['bob']);
  await customFact(w, host, { operation: 'create' });
}
export async function customHumans(
  w: CustomWorld,
  args: { host: string; white: string; black: string; active?: boolean }
): Promise<void> {
  const { host, white, black } = args;
  await customSpace(w, host, [
    ...new Set([white, black].filter((actor) => actor !== host)),
  ]);
  await customFact(w, host, { operation: 'create' });
  await customFact(w, host, { operation: 'open', side: 'white' });
  for (const [side, actor] of [
    ['white', white],
    ['black', black],
  ] as const) {
    await customFact(w, host, {
      operation: 'invite',
      side,
      person: customPerson(w, actor),
    });
    await customFact(w, actor, { operation: 'accept', side });
  }
  if (args.active) await customStart(w);
}
export async function customStart(w: CustomWorld): Promise<void> {
  const host = customHost(w);
  const game = await customGame(w);
  for (const side of ['white', 'black'] as const) {
    if (game[side].kind !== 'person') continue;
    if (game.ready.includes(side)) continue;
    const person = [...customPeople(w)].find(
      ([, id]) => id === game[side].person
    )?.[0];
    if (person === undefined) throw new Error(`no device for ${side}`);
    await customFact(w, person, { operation: 'ready' });
  }
  await customFact(w, host, { operation: 'start' });
  w.memo.set('custom-started', await customGame(w));
}
