/**
 * A private setup reaches only its person, for every game with private
 * setups, read where it leaves the platform: everything the space's room
 * sends each connection catching up from the start (what a reconnecting
 * device receives), and every row each device holds. The other participant,
 * a watcher and the creator receive neither setup of another; a bot's
 * setup reaches nobody; and what one person receives does not change when
 * only the other side's hidden setup does.
 */

import { expect, test } from 'bun:test';
import { hostedSpaceId } from '@libs/game-matchmaking-harness-ts/multiplayer-spaces';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  deviceRowsOf,
  roomHistorySentTo,
} from '@libs/game-session-harness-ts/private-setup-observation';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryGame } from '../game-suite';

function knownSetups(game: HarnessGame) {
  const setups = game.fixtures.setups;
  if (setups === undefined) throw new Error(`${game.label} names no setups`);
  return setups;
}

/** A complete setup of the game's own drawing, other than `than`. */
function anotherSetup(game: HarnessGame, than: string): string {
  const setup = game.shared.turnGame.rules.setup;
  if (setup === undefined) throw new Error(`${game.label} has no setups`);
  for (let draw = 0; draw < 64; draw += 1) {
    const drawn = setup.random(() => (draw + 0.5) / 64);
    if (drawn !== than) return drawn;
  }
  throw new Error(`${game.label} draws no other setup`);
}

/**
 * `text` as two worlds of one scenario would both write it: each generated
 * identifier named by its first appearance, and each time counted from the
 * first time it shows (worlds start their clocks apart).
 */
function namedInOrder(text: string): string {
  const names = new Map<string, string>();
  const first = Number(/\b1[0-9]{12}\b/.exec(text)?.[0] ?? 0);
  return text
    .replace(/\b1[0-9]{12}\b/g, (ms) => `t+${String(Number(ms) - first)}`)
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
      (id) => {
        const name = names.get(id) ?? `id-${String(names.size)}`;
        names.set(id, name);
        return name;
      }
    );
}

async function sentTo(s: OpenHarness, actor: string): Promise<string> {
  const spaceId = await s.read(hostedSpaceId, 'alice');
  if (spaceId === null) throw new Error('Alice hosts no space');
  return s.read(roomHistorySentTo, actor, spaceId);
}

forEveryGame(
  import.meta.path,
  (game) => {
    const setups = () => knownSetups(game);
    const opening = () => game.fixtures.firstSideVictory.slice(0, 2);

    test('each person receives their own setup alone; a watcher receives none', async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-private-setup-delivery`
      );
      await s.apply(establishCustomGame, game.shared.id, {
        watchers: ['carol'],
        moves: opening(),
      });
      const { white, black } = setups();
      const alice = await sentTo(s, 'alice');
      const bob = await sentTo(s, 'bob');
      const carol = await sentTo(s, 'carol');
      expect([alice.includes(white), alice.includes(black)]).toEqual([
        true,
        false,
      ]);
      expect([bob.includes(white), bob.includes(black)]).toEqual([false, true]);
      expect([carol.includes(white), carol.includes(black)]).toEqual([
        false,
        false,
      ]);
      for (const [person, own] of [
        ['alice', white],
        ['bob', black],
        ['carol', null],
      ] as const) {
        const rows = await s.read(deviceRowsOf, person);
        for (const hidden of [white, black])
          if (hidden !== own) expect(rows).not.toContain(hidden);
      }
    }, 240_000);

    test("a bot's setup reaches nobody, the creator included", async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-private-setup-bot`
      );
      await s.apply(establishCustomGame, game.shared.id, {
        second: 'bot',
        watchers: ['carol'],
      });
      const { white } = setups();
      for (const person of ['alice', 'carol']) {
        const sent = await sentTo(s, person);
        const chosen = [...sent.matchAll(/"setup":"([^"]*)"/g)].map(
          (m) => m[1]
        );
        // The creator receives only her own setup; the watcher none at all.
        expect(chosen).toEqual(person === 'alice' ? [white] : []);
      }
    }, 240_000);

    test("what a person receives does not change when only the other side's hidden setup does", async () => {
      const seen: string[] = [];
      for (const black of [
        setups().black,
        anotherSetup(game, setups().black),
      ]) {
        await using s = await openConformanceHarness(
          `${game.shared.id}-private-setup-noninterference`
        );
        await s.apply(establishCustomGame, game.shared.id, {
          watchers: ['carol'],
          setups: { black },
        });
        seen.push(
          namedInOrder((await sentTo(s, 'alice')) + (await sentTo(s, 'carol')))
        );
      }
      expect(seen[1]).toBe(seen[0]);
    }, 240_000);
  },
  ['a private setup', 'two seats']
);
