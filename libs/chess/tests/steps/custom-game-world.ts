import {
  establishCustomGame,
  openCustomGame,
} from '@libs/chess/harness/custom-game-actions';
import { readStoredCustomGames } from '@libs/chess/harness/custom-game-stored';
import { readCustomGameProbe } from '@libs/chess/harness/custom-game-ui';
import type {
  CustomGame,
  CustomGameInput,
} from '@libs/chess/public/custom-game';
import { focusActor } from '@libs/harness';
import type { HarnessWorld } from '@libs/harness/spec/define';
import {
  createSpace,
  joinViaLink,
  reopenSpaceLink,
} from '@libs/spaces/harness/space-actions';
import {
  activeSpaceVisible,
  readSpaceLink,
} from '@libs/spaces/harness/spaces-ui-reads';

export function customHost(w: HarnessWorld): string {
  return String(
    w.memo.get('custom-host') ?? w.memo.get('spaceHost') ?? 'alice'
  );
}
export function customPeople(w: HarnessWorld): Map<string, string> {
  const people = w.memo.get('custom-people');
  if (people instanceof Map) return people as Map<string, string>;
  const created = new Map<string, string>();
  w.memo.set('custom-people', created);
  return created;
}

export async function customSpace(
  w: HarnessWorld,
  host = customHost(w),
  others: readonly string[] = []
): Promise<void> {
  await w.s.apply(focusActor, host);
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
  for (const other of others) {
    await w.s.apply(joinViaLink, other, link);
    await w.s.apply(openCustomGame, other);
    const probe = await w.s.read(readCustomGameProbe, other);
    if (probe === null) throw new Error(`${other} has no game screen`);
    customPeople(w).set(other, probe.myId);
  }
}

export async function customFact(
  w: HarnessWorld,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  await w.s.apply(establishCustomGame, actor, input);
  if (input.operation === 'create')
    w.memo.set('custom-created-id', (await customGame(w)).id);
}
export async function customGame(
  w: HarnessWorld,
  actor?: string
): Promise<CustomGame> {
  const game =
    actor === undefined
      ? (
          await w.s.read(
            readStoredCustomGames,
            String(w.memo.get('custom-link')).split('/space/')[1] ?? ''
          )
        ).current
      : (await w.s.read(readCustomGameProbe, actor))?.current;
  if (game === null || game === undefined)
    throw new Error(`${actor} sees no game`);
  return game;
}
export function customPerson(w: HarnessWorld, actor: string): string {
  const id = customPeople(w).get(actor);
  if (id === undefined)
    throw new Error(`${actor} has no recorded member identity`);
  return id;
}

export async function customScreen(
  w: HarnessWorld,
  actor: string
): Promise<void> {
  if ((await w.s.read(readCustomGameProbe, actor)) !== null) return;
  await w.s.apply(reopenSpaceLink, actor, String(w.memo.get('custom-link')));
  await w.s.apply(openCustomGame, actor);
}

export async function customDefault(
  w: HarnessWorld,
  host: string
): Promise<void> {
  await customSpace(w, host, host === 'bob' ? ['alice'] : ['bob']);
  await customFact(w, host, { operation: 'create' });
}
export async function customHumans(
  w: HarnessWorld,
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
export async function customStart(w: HarnessWorld): Promise<void> {
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
