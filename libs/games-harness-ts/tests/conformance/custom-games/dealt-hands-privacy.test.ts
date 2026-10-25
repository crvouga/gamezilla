/**
 * A dealt hand reaches only its person, for every game whose authority
 * deals hands, read where it leaves the platform: everything the space's
 * room sends each connection catching up from the start (what a
 * reconnecting device receives), and every row each device holds. The other
 * participant and a watcher never receive another's hand, and nobody ever
 * receives the hidden state (the bag, the random state).
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

/** The two first hands of the known deal, and its hidden state. */
function knownDeal(game: HarnessGame) {
  const deal = game.fixtures.knownDeal;
  const first = deal?.hands?.[0];
  if (
    deal === undefined ||
    first?.white === undefined ||
    first.black === undefined
  )
    throw new Error(`${game.label} writes no first hands of its known deal`);
  return { white: first.white, black: first.black, hidden: deal.hidden };
}

async function sentTo(s: OpenHarness, actor: string): Promise<string> {
  const spaceId = await s.read(hostedSpaceId, 'alice');
  if (spaceId === null) throw new Error('Alice hosts no space');
  return s.read(roomHistorySentTo, actor, spaceId);
}

forEveryGame(
  import.meta.path,
  (game) => {
    test('each person receives their own hand alone; a watcher none; nobody the hidden state', async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-dealt-hands-delivery`
      );
      await s.apply(establishCustomGame, game.shared.id, {
        watchers: ['carol'],
      });
      const { white, black, hidden } = knownDeal(game);
      const received = {
        alice: `${await sentTo(s, 'alice')}${await s.read(deviceRowsOf, 'alice')}`,
        bob: `${await sentTo(s, 'bob')}${await s.read(deviceRowsOf, 'bob')}`,
        carol: `${await sentTo(s, 'carol')}${await s.read(deviceRowsOf, 'carol')}`,
      };
      expect([
        received.alice.includes(white),
        received.alice.includes(black),
      ]).toEqual([true, false]);
      expect([
        received.bob.includes(white),
        received.bob.includes(black),
      ]).toEqual([false, true]);
      expect([
        received.carol.includes(white),
        received.carol.includes(black),
      ]).toEqual([false, false]);
      // Not the hidden state, nor its bag in any spelling.
      const bag = (JSON.parse(hidden) as { bag: number[] }).bag
        .slice(0, 12)
        .join(',');
      for (const text of Object.values(received)) {
        expect(text.includes(hidden)).toBe(false);
        expect(text.includes(bag)).toBe(false);
      }
    }, 240_000);
  },
  ['dealt hands', 'two seats']
);
