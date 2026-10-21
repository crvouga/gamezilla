/**
 * What a person's finding an opponent shows of their matched game, or of
 * the one they watch, whichever game it is: who won, their board and
 * opponent, the last known board of an offline device, the moves in the
 * move list as the game writes them, and the game record on offer.
 */

import { expect } from 'bun:test';
import {
  command,
  matchedGameOf,
  move,
  ownerOf,
  pairOf,
  viewerOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { multiplayerBoardShown } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import { gameRecordOffered } from '@libs/game-matchmaking-harness-ts/multiplayer-game-record';
import {
  multiplayerView,
  shownMultiplayerText,
} from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { reviewMultiplayerMoves } from '@libs/game-matchmaking-harness-ts/multiplayer-review';
import { openFindingAnOpponentIfAny } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { actorUi } from '@libs/harness-ts/actor-ui';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { nameEveryoneSeesOf } from '@libs/profile-harness-ts/profile-ui-reads';
import { gameOf } from './game-world';
import { firstMoveOf, readyPeople, victoryMoveAt } from './matched-game';
import { deviceOffline, keepsLastKnownBoard } from './matched-game-connection';

/** `person`'s device shows finding an opponent, as far as it can. */
export function openOn(w: HarnessWorld, device: string) {
  return w.s.apply(openFindingAnOpponentIfAny, device, gameOf(w).shared.id);
}

/** The moves the device's move list shows, each as the game writes it. */
export async function shownMoveLabels(
  s: ProductHarness,
  actor: string
): Promise<readonly string[]> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  const labels: string[] = [];
  for (let ply = 1; ; ply++) {
    const move = ui.get(`multiplayer-move-${String(ply)}`);
    if (!(await move.isVisible())) return labels;
    labels.push(((await move.text()) ?? '').trim());
  }
}

/** `person`'s move list shows the game's victory's first `count` moves. */
export async function seesVictoryMoves(
  w: HarnessWorld,
  person: string,
  count: number
) {
  const device = viewerOf(w, person);
  const wanted = gameOf(w).fixtures.firstSideVictoryLabels.slice(0, count);
  await openOn(w, device);
  await w.s.until((s) => shownMoveLabels(s, device), {
    pred: (shown) => JSON.stringify(shown) === JSON.stringify(wanted),
  });
  expect(await w.s.read(shownMoveLabels, device)).toEqual(wanted);
}

/** The scenario's matched game as it was paired: who has the first side. */
function pairedGame(w: HarnessWorld): MultiplayerGame {
  const game = w.memo.get('multiplayer:game') as MultiplayerGame | undefined;
  if (game === undefined) throw new Error('No matched game was set up');
  return game;
}

/** `person` sees `winner` won the matched game on their own screen. */
async function seesWinner(w: HarnessWorld, person: string, winner: string) {
  const device = viewerOf(w, person);
  const side =
    pairedGame(w).white_id === (await ownerOf(w, winner)) ? 'white' : 'black';
  await openOn(w, device);
  await w.s.until(
    async (s) => (await multiplayerBoardShown(s, device)).outcome,
    {
      pred: (outcome) => outcome !== null && outcome !== 'ongoing',
    }
  );
  expect((await w.s.read(multiplayerBoardShown, device)).outcome).toBe(side);
}

/** Whether `person` is offered both, or neither, to copy. */
export async function recordOffered(
  w: HarnessWorld,
  person: string,
  expected: boolean
) {
  const device = viewerOf(w, person);
  await openOn(w, device);
  const wanted = { gameRecord: expected, finalPosition: expected };
  await w.s.until((s) => gameRecordOffered(s, device), {
    pred: (shown) =>
      shown.gameRecord === expected && shown.finalPosition === expected,
  });
  expect(await w.s.read(gameRecordOffered, device)).toEqual(wanted);
}

Then('{actor} sees she/he won the matched game', (w, actor: string) =>
  seesWinner(w, actor, actor)
);
Then(
  '{actor} sees {actor} won the matched game',
  (w, person: string, winner: string) => seesWinner(w, person, winner)
);
Then('{actor} sees the matched game was aborted', async (w, actor: string) => {
  const device = viewerOf(w, actor);
  await openOn(w, device);
  await w.s.until(
    async (s) => (await multiplayerBoardShown(s, device)).outcome,
    {
      pred: (outcome) => outcome === 'aborted',
    }
  );
});
Then(
  '{actor} sees her/his board and {actor} as her/his opponent',
  async (w, actor: string, opponent: string) => {
    const device = viewerOf(w, actor);
    await openOn(w, device);
    const name = String(await w.s.read(nameEveryoneSeesOf, opponent));
    await w.s.until(
      (s) => shownMultiplayerText(s, device, 'multiplayer-opponent'),
      { pred: (shown) => shown?.includes(name) === true }
    );
    expect((await w.s.read(multiplayerBoardShown, device)).gameId).toBe(
      (await w.s.read(multiplayerView, device)).game?.id ?? null
    );
  }
);
Then("{actor}'s phone keeps its last known board", (w, actor: string) =>
  keepsLastKnownBoard(w, actor)
);

Given(
  "{actor}'s phone was offline when {actor}'s first move was accepted",
  async (w, offline: string, mover: string) => {
    await deviceOffline(w, offline);
    expect((await move(w, mover, firstMoveOf(w, mover))).result.ok).toBe(true);
    await w.s.until(async (s) => (await multiplayerView(s, mover)).game, {
      pred: (game) => game?.revision === 2,
    });
  }
);

Then('{actor} sees both first moves in the move list', (w, actor: string) =>
  seesVictoryMoves(w, actor, 2)
);
Then("{actor} sees {actor}'s first move in the move list", (w, actor: string) =>
  seesVictoryMoves(w, actor, 1)
);
Then(
  "{actor}, {actor} and {actor} see {actor}'s first move in the move list",
  async (w, ...people: [string, string, string, string]) => {
    for (const person of people.slice(0, 3))
      await seesVictoryMoves(w, person, 1);
  }
);
Then(
  "{actor} sees both first moves and {actor}'s next move in the move list",
  (w, actor: string) => seesVictoryMoves(w, actor, 3)
);
Then(
  "both people see both first moves and {actor}'s next move in the move list",
  async (w) => {
    for (const person of pairOf(w)) await seesVictoryMoves(w, person, 3);
  }
);

When(
  '{actor} chooses the first move in the move list',
  async (w, actor: string) => {
    const device = viewerOf(w, actor);
    await openOn(w, device);
    await w.s.apply(reviewMultiplayerMoves, device, 1);
  }
);
Then(
  '{actor} is offered the game record and the final position',
  (w, actor: string) => recordOffered(w, actor, true)
);
Then(
  '{actor} is not offered the game record or the final position',
  (w, actor: string) => recordOffered(w, actor, false)
);

/** A person with an account and a space of their own, unless they watch. */
async function outsider(w: HarnessWorld, person: string) {
  // A guest watching already has the matched game in front of them.
  if ((await w.s.read(multiplayerBoardShown, person)).gameId !== null) return;
  if ((await w.s.read(multiplayerView, person)).game === null)
    await readyPeople(w, [person]);
}

When(
  "{actor} opens {actor}'s matched game",
  async (w, person: string, owner: string) => {
    await matchedGameOf(w, owner);
    await outsider(w, person);
    await openOn(w, person);
  }
);
When(
  "{actor} makes a move in {actor}'s matched game",
  async (w, person: string, owner: string) => {
    const game = await matchedGameOf(w, owner);
    await outsider(w, person);
    await command(w, person, 'playMultiplayerMove', {
      gameId: game.id,
      revision: game.revision,
      uci: victoryMoveAt(w, game.revision),
    });
    await openOn(w, person);
  }
);
Then(
  '{actor} is told no matched game is available to her',
  async (w, actor: string) => {
    await w.s.until(
      (s) => shownMultiplayerText(s, actor, 'multiplayer-unavailable'),
      {
        pred: (shown) => shown !== null,
      }
    );
    expect((await w.s.read(multiplayerView, actor)).game).toBeNull();
  }
);
