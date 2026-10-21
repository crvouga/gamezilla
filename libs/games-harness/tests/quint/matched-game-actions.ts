/**
 * The actions of `specs/games/matched-game.qnt` in the trace's game: its
 * people's own spaces, the commands their devices send, the pairings
 * matchmaking hands over, the victory's moves and the moves the game
 * refuses.
 */

import {
  confirmDeletion,
  runPrivacyJobs,
} from '@libs/account-privacy-harness/privacy-actions';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness/multiplayer-connection';
import {
  controlledMultiplayerCommand,
  multiplayerMatchFact,
  receiveMultiplayerMatch,
} from '@libs/game-matchmaking-harness/multiplayer-events';
import { multiplayerFingerprint } from '@libs/game-matchmaking-harness/multiplayer-fingerprint';
import {
  multiplayerView,
  storedMultiplayerSnapshot,
} from '@libs/game-matchmaking-harness/multiplayer-reads';
import { chooseKnownSetups } from '@libs/game-matchmaking-harness/multiplayer-setups';
import { passMultiplayerTime } from '@libs/game-matchmaking-harness/multiplayer-time';
import {
  givenGameSpace,
  openFindingAnOpponentIfAny,
} from '@libs/game-matchmaking-harness/opponent-seeking';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { accountIdOf } from '@libs/harness/identity';
import type { Picks } from '@pkgs/quint-shared/registry';
import { productClockChoice } from './matched-game-clock';
import type { PlayTrace } from './matched-game-model-world';
import {
  PLAY_PEOPLE,
  playActor,
  playFacts,
  playId,
  playRequest,
} from './matched-game-model-world';
import { modelGameOf, refusedMoveOf, victoryOf } from './model-game';

export async function initPlay(w: PlayTrace) {
  const owners = new Map<string, string>();
  for (const person of PLAY_PEOPLE) {
    await w.s.apply(signInWithGoogle, person);
    await w.s.apply(givenGameSpace, person);
    owners.set((await w.s.read(accountIdOf, person))!, person);
    await w.s.apply(signInWithGoogleAsAccount, `${person}_computer`, person);
    await w.s.apply(givenGameSpace, `${person}_computer`);
  }
  w.memo.set('play:owners', owners);
}

function command(
  w: PlayTrace,
  actor: string,
  name: string,
  args: Record<string, unknown>
) {
  return w.s.apply(controlledMultiplayerCommand, actor, {
    name,
    args: { requestId: playRequest(w), ...args },
  });
}

/** A command on one of the model's matched-game numbers. */
function onGame(name: string, device = 'device', number = 'number') {
  return (w: PlayTrace, picks: Picks) =>
    command(w, playActor(picks, device), name, {
      gameId: playId(w, Number(picks[number])),
    });
}

export const resignGame = onGame('resignMultiplayer');
export const abortGame = onGame('abortMultiplayer');
export const offerDraw = onGame('offerMultiplayerDraw');
export const acceptDraw = onGame(
  'acceptMultiplayerDraw',
  'answerDevice',
  'answerNumber'
);
export const declineDraw = onGame(
  'declineMultiplayerDraw',
  'answerDevice',
  'answerNumber'
);
export const offerRematch = onGame('offerMultiplayerRematch');
const answerRematch = onGame(
  'acceptMultiplayerRematch',
  'answerDevice',
  'answerNumber'
);
/** An accepted rematch is a new matched game, ready to play like any pairing's. */
export async function acceptRematch(w: PlayTrace, picks: Picks) {
  await answerRematch(w, picks);
  await w.s.apply(chooseKnownSetups, PLAY_PEOPLE);
}
export const declineRematch = onGame(
  'declineMultiplayerRematch',
  'answerDevice',
  'answerNumber'
);

/** Seeking an opponent at the model's clock choice, in the trace's game. */
export async function seekOpponent(w: PlayTrace, picks: Picks) {
  await command(w, playActor(picks), 'findChessOpponent', {
    timeControl: productClockChoice(w, String(picks['control'])),
  });
}

/** From the person's current matched game, as their screen shows it. */
export async function findNewOpponent(w: PlayTrace, picks: Picks) {
  const actor = playActor(picks);
  const game = (await w.s.read(multiplayerView, actor)).game;
  await command(w, actor, 'findNewChessOpponent', {
    gameId: game?.id ?? 'no-game',
  });
}

export async function stopSeeking(w: PlayTrace, picks: Picks) {
  const actor = playActor(picks);
  const search = (await w.s.read(multiplayerView, actor)).search;
  await command(w, actor, 'stopFindingChessOpponent', {
    searchId: search?.search_id ?? 'unknown-search',
  });
}

/**
 * Matchmaking has already paired the two people; the product gives the
 * second side to the greater side balance, and equal balances keep the
 * first named on the first side, as the model's own pairing does.
 */
export async function pairPeopleUp(w: PlayTrace, picks: Picks) {
  const number = Number(picks['matchNumber']);
  let fact = playFacts(w).get(number);
  if (fact === undefined) {
    const sides = [String(picks['first']), String(picks['second'])];
    fact = {
      sides,
      formation: await w.s.read(multiplayerMatchFact, `match-${number}`, sides),
    };
    playFacts(w).set(number, fact);
  }
  await w.s.apply(receiveMultiplayerMatch, fact.formation, true);
}

/** The victory's move at `position`, or a move the game refuses. */
function moveAt(w: PlayTrace, position: number, legal: boolean): string {
  if (!legal) return refusedMoveOf(w);
  return victoryOf(modelGameOf(w))[position] ?? refusedMoveOf(w);
}

export async function playMove(w: PlayTrace, picks: Picks) {
  const position = Number(picks['position']);
  await command(w, playActor(picks, 'moveDevice'), 'playMultiplayerMove', {
    gameId: playId(w, Number(picks['moveNumber'])),
    revision: position,
    uci: moveAt(w, position, picks['legal'] === true),
  });
}

/** The victory's next move of the matched game the device shows, for its board. */
export async function playCurrentMove(w: PlayTrace, picks: Picks) {
  const actor = playActor(picks, 'moveDevice');
  const game = (await w.quiet.read(multiplayerView, actor)).game;
  const position = game?.revision ?? 0;
  await command(w, actor, 'playMultiplayerMove', {
    gameId: game?.id ?? playId(w, 0),
    revision: position,
    uci: moveAt(w, position, true),
  });
}

export async function deleteAccount(w: PlayTrace, picks: Picks) {
  const person = String(picks['person']);
  if ((await w.s.read(accountIdOf, person)) === null) return;
  // Confirmed deletion is an upstream fact, independent of these two devices.
  const proof = `${person}_privacy`;
  await w.s.apply(signInWithGoogleAsAccount, proof, person);
  await w.s.apply(confirmDeletion, proof);
  await w.s.apply(runPrivacyJobs);
}

/** Seconds pass for everyone, devices and server, whoever is online. */
export async function secondsPass(w: PlayTrace, picks: Picks) {
  await w.s.apply(passMultiplayerTime, Number(picks['seconds']) * 1000);
}

export async function openOwnFindingAnOpponent(w: PlayTrace, picks: Picks) {
  await w.s.apply(
    openFindingAnOpponentIfAny,
    playActor(picks),
    modelGameOf(w).shared.id
  );
}

export async function connectPlay(
  w: PlayTrace,
  picks: Picks,
  connected: boolean
) {
  const actor = playActor(picks);
  // An offline device keeps showing its clocks and search time from then.
  if (connected) w.memo.delete(`play:offline:${actor}`);
  else
    w.memo.set(
      `play:offline:${actor}`,
      await w.s.read((s) => s.harness.clock.now())
    );
  await w.s.apply(setMultiplayerConnection, actor, connected);
}

export async function playFingerprint(w: PlayTrace) {
  return multiplayerFingerprint(
    await w.quiet.read(storedMultiplayerSnapshot),
    w.memo.get('play:owners') as ReadonlyMap<string, string>
  );
}
