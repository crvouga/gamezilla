import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
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
    await w.s.apply(givenMultiplayerSpace, person);
    owners.set((await w.s.read(accountIdOf, person))!, person);
    await w.s.apply(signInWithGoogleAsAccount, `${person}_computer`, person);
  }
  w.memo.set('play:owners', owners);
}

export async function askForPlay(w: PlayTrace, picks: Picks) {
  await w.s.apply(controlledMultiplayerCommand, playActor(picks), {
    name: 'findChessOpponent',
    args: { requestId: playRequest(w) },
  });
}

export async function stopLooking(w: PlayTrace, picks: Picks) {
  const actor = playActor(picks);
  const search = (await w.s.read(multiplayerView, actor)).search;
  await w.s.apply(controlledMultiplayerCommand, actor, {
    name: 'stopFindingChessOpponent',
    args: {
      requestId: playRequest(w),
      searchId: search?.search_id ?? 'unknown-search',
    },
  });
}

export async function receivePlay(w: PlayTrace, picks: Picks) {
  const number = Number(picks['matchNumber']);
  let fact = playFacts(w).get(number);
  if (fact === undefined) {
    const sides = [String(picks['white']), String(picks['black'])];
    fact = {
      sides,
      formation: await w.s.read(multiplayerMatchFact, `match-${number}`, sides),
    };
    playFacts(w).set(number, fact);
  }
  await w.s.apply(receiveMultiplayerMatch, fact.formation);
}

export async function moveInPlay(w: PlayTrace, picks: Picks) {
  const position = Number(picks['position']);
  const line = PLAY_LINES[Number(picks['sequence'])];
  await w.s.apply(
    controlledMultiplayerCommand,
    playActor(picks, 'moveDevice'),
    {
      name: 'playMultiplayerMove',
      args: {
        requestId: playRequest(w),
        gameId: playId(w, Number(picks['moveNumber'])),
        revision: position,
        uci: picks['legal'] === true ? (line?.[position] ?? 'a1a1') : 'a1a1',
      },
    }
  );
}

export async function resignPlay(w: PlayTrace, picks: Picks) {
  await w.s.apply(controlledMultiplayerCommand, playActor(picks), {
    name: 'resignMultiplayer',
    args: {
      requestId: playRequest(w),
      gameId: playId(w, Number(picks['number'])),
    },
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

export async function showPlay(w: PlayTrace, picks: Picks) {
  await w.s.apply(openMultiplayerChess, playActor(picks));
}

export async function connectPlay(
  w: PlayTrace,
  picks: Picks,
  connected: boolean
) {
  await w.s.apply(setMultiplayerConnection, playActor(picks), connected);
}

export async function playFingerprint(w: PlayTrace) {
  return multiplayerFingerprint(
    await w.quiet.read(storedMultiplayerSnapshot),
    w.memo.get('play:owners') as ReadonlyMap<string, string>
  );
}
