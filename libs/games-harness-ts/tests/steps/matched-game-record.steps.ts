/**
 * Copying a finished matched game's game record or final position,
 * whichever game it is. The record is read back through the game's own
 * format (`readRecord`) and held to what the scenario knows independently:
 * the names everyone sees now, the result, the clock choice and the
 * game's own names for its first moves.
 */

import { expect } from 'bun:test';
import {
  acceptedMoves,
  bothBoards,
  gameCommand,
  matchedGameOf,
  ownerOf,
  resignation,
  viewerOf,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import type { MultiplayerCopy } from '@libs/game-matchmaking-harness-ts/multiplayer-game-record';
import {
  copiedMultiplayerText,
  copyShownMultiplayerText,
  gameRecordOffered,
} from '@libs/game-matchmaking-harness-ts/multiplayer-game-record';
import type { ReadGameRecord } from '@libs/game-session-harness-ts/harness-game';
import { Given, Then, When } from '@libs/harness-ts/define';
import { otherDevice } from '@libs/harness-ts/platform';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  nameEveryoneSeesOf,
  standInNameOf,
} from '@libs/profile-harness-ts/profile-ui-reads';
import { gameOf, turnGameOf } from './game-world';
import { firstMoveOf, pairedAt } from './matched-game';
import { openOn } from './matched-game-shown.steps';

const copierKey = (person: string) => `matched-game:copied-on:${person}`;

/** `person` copies what their screen offers, on `device`, once it offers it. */
async function copy(
  w: HarnessWorld,
  person: string,
  device: string,
  what: MultiplayerCopy
) {
  await openOn(w, device);
  await w.s.until((s) => gameRecordOffered(s, device), {
    pred: (offered) => offered.gameRecord && offered.finalPosition,
  });
  await w.s.apply(copyShownMultiplayerText, device, what);
  w.memo.set(copierKey(person), device);
}

/** What `person` last copied, on the device they copied it on. */
async function copiedBy(w: HarnessWorld, person: string): Promise<string> {
  const device = String(w.memo.get(copierKey(person)) ?? viewerOf(w, person));
  const copied = await w.s.read(copiedMultiplayerText, device);
  if (copied === null) throw new Error(`${person} copied nothing`);
  return copied;
}

/** The game record `person` copied, read in the game's own format. */
async function recordCopiedBy(
  w: HarnessWorld,
  person: string
): Promise<ReadGameRecord> {
  const read = turnGameOf(w).readRecord;
  if (read === undefined)
    throw new Error(`${gameOf(w).label} reads no game record`);
  return read(await copiedBy(w, person));
}

/** The record gives `result`, `clock` and the game's first two moves. */
async function recordGives(
  w: HarnessWorld,
  person: string,
  wanted: { readonly result: ReadGameRecord['result']; readonly clock: string }
) {
  const record = await recordCopiedBy(w, person);
  expect({
    result: record.result,
    clockChoice: record.clockChoice,
    moves: record.moves,
  }).toEqual({
    result: wanted.result,
    clockChoice: wanted.clock,
    moves: turnGameOf(w).fixtures.firstSideVictoryLabels.slice(0, 2),
  });
}

/** The name the record gives `person`, by the side they played. */
async function nameGiven(w: HarnessWorld, copier: string, person: string) {
  const record = await recordCopiedBy(w, copier);
  const first = (await bothBoards(w)).white_id === (await ownerOf(w, person));
  return first ? record.firstSide : record.secondSide;
}

Given('{actor} has resigned the matched game', async (w, person: string) => {
  expect((await resignation(w, person)).result.ok).toBe(true);
  await bothBoards(w, (game) => game.outcome !== 'ongoing');
});
Given(
  "{actor}'s {word} matched game with {actor} was aborted after her first move",
  async (w, first: string, clock: string, second: string) => {
    await pairedAt(w, first, second, clock);
    await acceptedMoves(w, [firstMoveOf(w, first)]);
    expect((await gameCommand(w, second, 'abortMultiplayer')).result.ok).toBe(
      true
    );
    await bothBoards(w, (game) => game.outcome === 'aborted');
  }
);

When('{actor} copies the game record', (w, person: string) =>
  copy(w, person, viewerOf(w, person), 'game record')
);
When('{actor} copies the game record on another device', (w, person: string) =>
  copy(w, person, otherDevice(person), 'game record')
);
When('{actor} copies the final position', (w, person: string) =>
  copy(w, person, viewerOf(w, person), 'final position')
);

Then(
  'the final position {actor} copied is the position after their first moves',
  async (w, person: string) => {
    const game = await matchedGameOf(w, viewerOf(w, person));
    expect(game.revision).toBe(2);
    expect(await copiedBy(w, person)).toBe(game.fen);
  }
);
Then(
  'the game record {actor} copied names {actor} on the first side and {actor} on the second side',
  async (w, copier: string, first: string, second: string) => {
    const record = await recordCopiedBy(w, copier);
    expect([record.firstSide, record.secondSide]).toEqual([
      await w.s.read(nameEveryoneSeesOf, first),
      await w.s.read(nameEveryoneSeesOf, second),
    ]);
  }
);
Then(
  'the game record {actor} copied gives a victory for the {gameSide}, the clock choice {word} and both first moves',
  (w, person: string, side: 'white' | 'black', clock: string) =>
    recordGives(w, person, { result: side, clock })
);
Then(
  'the game record {actor} copied gives a draw, the clock choice {word} and both first moves',
  (w, person: string, clock: string) =>
    recordGives(w, person, { result: 'draw', clock })
);
Then(
  'the game record {actor} copied names {actor} as {username}',
  async (w, copier: string, person: string, username: string) => {
    expect(await nameGiven(w, copier, person)).toBe(username);
  }
);
Then(
  'the game record {actor} copied names {actor} by her stand-in name',
  async (w, copier: string, person: string) => {
    const standIn = await w.s.read(standInNameOf, person);
    if (standIn === null) throw new Error(`${person} has no profile yet`);
    expect(await nameGiven(w, copier, person)).toBe(standIn);
  }
);
