import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { playCustomGameHistory } from '@libs/chess-custom-game-harness/custom-game-history';
import { readStoredCustomGames } from '@libs/chess-custom-game-harness/custom-game-stored';
import type { CustomGameSide } from '@libs/chess-custom-game-shared/custom-game-state';
import { setupBlock } from '@libs/friends-harness/setup-block';
import { signInWithGoogleAsAccount } from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  CONFIGURATION_DEVICES,
  configurationLink,
  configurationName,
} from './custom-game-configuration-world';

/**
 * The moves each side plays when the model says it moved: the a-, b- and
 * c-pawns, so every decisive ending the model may still ask for stays legal
 * after them and no position repeats.
 */
const SIDE_MOVES: Readonly<Record<CustomGameSide, readonly string[]>> = {
  white: ['a2a3', 'b2b3', 'c2c3', 'a3a4', 'b3b4', 'c3c4'],
  black: ['a7a6', 'b7b6', 'c7c6', 'a6a5', 'b6b5', 'c6c5'],
};

function spaceId(w: QuintHarnessWorld): string {
  return configurationLink(w).split('/space/')[1] ?? '';
}

/** The next of `side`'s moves after `played` moves of the whole game. */
export function nextSideMove(side: CustomGameSide, played: number): string {
  const own = side === 'white' ? Math.ceil(played / 2) : Math.floor(played / 2);
  const move = SIDE_MOVES[side][own];
  if (move === undefined)
    throw new Error(`${side} has no further move the model can still finish`);
  return move;
}

/** A device of `person` with a connection and a signed-in account. */
function connectedDevice(w: QuintHarnessWorld, person: string): string | null {
  const offline = w.memo.get('configuration-offline') as Set<string>;
  const signedOut = w.memo.get('configuration-signed-out') as Set<string>;
  return (
    CONFIGURATION_DEVICES.find(
      (device) =>
        (device === 'alice-other' ? 'alice' : device) === person &&
        !offline.has(device) &&
        !signedOut.has(device)
    ) ?? null
  );
}

/**
 * `_sideMoves`: the side's person plays its next move through the board; a
 * bot plays its own turns as time passes, which changes nothing the model
 * observes (only a game between two people can be offered a draw or
 * cancelled by its other participant).
 */
export async function configurationSideMoves(
  w: QuintHarnessWorld,
  side: CustomGameSide
): Promise<void> {
  const game = (await w.s.read(readStoredCustomGames, spaceId(w))).current;
  if (game === null || game.status !== 'active')
    throw new Error('A side moved without an active Custom Game');
  if (game[side].kind === 'bot') return;
  if (game.turn !== side)
    throw new Error(
      `The model lets ${side} move while ${game.turn} is to move; chess alternates turns`
    );
  const device = connectedDevice(w, configurationName(w, game[side].person));
  if (device === null)
    throw new Error(`${side} has no connected device to move with`);
  await w.s.apply(changeCustomGame, device, {
    operation: 'move',
    uci: nextSideMove(side, game.moves.length),
    ply: game.moves.length,
  });
}

/**
 * `_personBlocks`: the person blocks someone through their account; with no
 * connected device of their own, from another device signed into it.
 */
export async function configurationBlocks(
  w: QuintHarnessWorld,
  blocker: string,
  blocked: string
): Promise<void> {
  let device = connectedDevice(w, blocker);
  if (device === null) {
    device = `${blocker}-blocking`;
    const signedIn = (w.memo.get('configuration-blocking-devices') ??
      new Set<string>()) as Set<string>;
    w.memo.set('configuration-blocking-devices', signedIn);
    if (!signedIn.has(device))
      await w.s.apply(signInWithGoogleAsAccount, device, blocker);
    signedIn.add(device);
  }
  await w.s.apply(setupBlock, device, blocked);
}

/** Bring the side `turn` to move with `side`'s next move, if it is not already. */
export async function configurationTurn(
  w: QuintHarnessWorld,
  turn: CustomGameSide,
  devices: { readonly white: string; readonly black: string }
): Promise<void> {
  const game = (await w.s.read(readStoredCustomGames, spaceId(w))).current;
  if (game === null || game.turn === turn) return;
  await w.s.apply(playCustomGameHistory, {
    spaceId: spaceId(w),
    ...devices,
    moves: [nextSideMove(game.turn, game.moves.length)],
  });
}
