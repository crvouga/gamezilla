import {
  confirmDeletion,
  runPrivacyJobs,
} from '@libs/account-privacy-harness/privacy-actions';
import {
  openMultiplayerChess,
  setMultiplayerConnection,
} from '@libs/chess-matchmaking-harness/multiplayer-actions';
import { multiplayerFingerprint } from '@libs/chess-matchmaking-harness/multiplayer-fingerprint';
import {
  multiplayerView,
  storedMultiplayerSnapshot,
} from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { passMultiplayerTime } from '@libs/chess-matchmaking-harness/multiplayer-time';
import {
  controlledMultiplayerCommand,
  multiplayerMatchFact,
  receiveMultiplayerMatch,
} from '@libs/chess-root-harness/multiplayer-events';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { accountIdOf } from '@libs/harness/identity';
import type { Picks } from '@pkgs/quint-shared/registry';
import type { PlayTrace } from './multiplayer-world';
import {
  PLAY_LINES,
  PLAY_PEOPLE,
  playActor,
  playFacts,
  playId,
  playRequest,
} from './multiplayer-world';

export async function initPlay(w: PlayTrace) {
  const owners = new Map<string, string>();
  for (const person of PLAY_PEOPLE) {
    await w.s.apply(signInWithGoogle, person);
    owners.set((await w.s.read(accountIdOf, person))!, person);
    await w.s.apply(signInWithGoogleAsAccount, `${person}_computer`, person);
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

/** A command on one of the model's game numbers. */
function onGame(name: string, device = 'device', number = 'number') {
  return (w: PlayTrace, picks: Picks) =>
    command(w, playActor(picks, device), name, {
      gameId: playId(w, Number(picks[number])),
    });
}

export const resignPlay = onGame('resignMultiplayer');
export const abortPlay = onGame('abortMultiplayer');
export const offerPlayDraw = onGame('offerMultiplayerDraw');
export const acceptPlayDraw = onGame(
  'acceptMultiplayerDraw',
  'answerDevice',
  'answerNumber'
);
export const declinePlayDraw = onGame(
  'declineMultiplayerDraw',
  'answerDevice',
  'answerNumber'
);
export const offerRematch = onGame('offerMultiplayerRematch');
export const acceptRematch = onGame(
  'acceptMultiplayerRematch',
  'answerDevice',
  'answerNumber'
);
export const declineRematch = onGame(
  'declineMultiplayerRematch',
  'answerDevice',
  'answerNumber'
);

export async function askForPlay(w: PlayTrace, picks: Picks) {
  await command(w, playActor(picks), 'findChessOpponent', {
    timeControl: String(picks['control']),
  });
}

/** From the person's current game, as their screen shows it. */
export async function askAgain(w: PlayTrace, picks: Picks) {
  const actor = playActor(picks);
  const game = (await w.s.read(multiplayerView, actor)).game;
  await command(w, actor, 'findNewChessOpponent', {
    gameId: game?.id ?? 'no-game',
  });
}

export async function stopLooking(w: PlayTrace, picks: Picks) {
  const actor = playActor(picks);
  const search = (await w.s.read(multiplayerView, actor)).search;
  await command(w, actor, 'stopFindingChessOpponent', {
    searchId: search?.search_id ?? 'unknown-search',
  });
}

/**
 * Matchmaking has already chosen the two people; the product gives Black to
 * the greater colour balance, and equal balances keep the first named White,
 * as the model's own pairing does.
 */
export async function receivePlay(w: PlayTrace, picks: Picks) {
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

export async function moveInPlay(w: PlayTrace, picks: Picks) {
  const position = Number(picks['position']);
  const line = PLAY_LINES[Number(picks['sequence'])];
  await command(w, playActor(picks, 'moveDevice'), 'playMultiplayerMove', {
    gameId: playId(w, Number(picks['moveNumber'])),
    revision: position,
    uci: picks['legal'] === true ? (line?.[position] ?? 'a1a1') : 'a1a1',
  });
}

/** The legal next move of the game the device shows, for its board. */
export async function moveCurrentPlay(w: PlayTrace, picks: Picks) {
  const actor = playActor(picks, 'moveDevice');
  const game = (await w.quiet.read(multiplayerView, actor)).game;
  const position = game?.revision ?? 0;
  const line = PLAY_LINES[Number(picks['sequence'])];
  await command(w, actor, 'playMultiplayerMove', {
    gameId: game?.id ?? playId(w, 0),
    revision: position,
    uci: line?.[position] ?? 'a1a1',
  });
}

export async function deletePlayAccount(w: PlayTrace, picks: Picks) {
  const person = String(picks['person']);
  if ((await w.s.read(accountIdOf, person)) === null) return;
  // Confirmed deletion is an upstream fact, independent of these two devices.
  const proof = `${person}_privacy`;
  await w.s.apply(signInWithGoogleAsAccount, proof, person);
  await w.s.apply(confirmDeletion, proof);
  await w.s.apply(runPrivacyJobs);
}

/** Seconds pass for everyone, devices and server, whoever is online. */
export async function passPlayTime(w: PlayTrace, picks: Picks) {
  await w.s.apply(passMultiplayerTime, Number(picks['seconds']) * 1000);
}

export async function showPlay(w: PlayTrace, picks: Picks) {
  await w.s.apply(openMultiplayerChess, playActor(picks));
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
