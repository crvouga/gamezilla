import { setupBlock } from '@libs/friends-harness/setup-block';
import { playCustomGameHistory } from '@libs/game-session-harness/custom-game-history';
import {
  firstLegalMove,
  makeCustomGameMove,
} from '@libs/game-session-harness/custom-game-moves';
import { readStoredCustomGames } from '@libs/game-session-harness/custom-game-stored';
import type {
  CustomGame,
  CustomGameSide,
} from '@libs/game-session-shared/custom-game-state';
import { signInWithGoogleAsAccount } from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  CONFIGURATION_DEVICES,
  configurationName,
  configurationSpaceId,
} from './custom-game-configuration-world';
import { modelGameOf, victoryOf } from './model-game';

/** Whether the custom game's moves are still the first moves of the victory. */
export function onVictoryLine(w: QuintHarnessWorld, game: CustomGame): boolean {
  const victory = victoryOf(modelGameOf(w));
  return game.moves.every((move, ply) => move.uci === victory[ply]);
}

/**
 * The next move of the custom game: the victory's, while its moves follow
 * the victory (always so between two people, whose game the victory may
 * finish), or else one the game allows after a bot's own choice.
 */
export function nextModelMove(w: QuintHarnessWorld, game: CustomGame): string {
  const victory = victoryOf(modelGameOf(w));
  const next = victory[game.moves.length];
  if (onVictoryLine(w, game) && next !== undefined) return next;
  return firstLegalMove(modelGameOf(w), game.fen);
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
 * `_sideMoves`: the side's person makes its next move as a person does; a
 * bot plays its own turns as time passes, which changes nothing the model
 * observes (only a custom game between two people can be offered a draw or
 * cancelled by its other participant).
 */
export async function configurationSideMoves(
  w: QuintHarnessWorld,
  side: CustomGameSide
): Promise<void> {
  const game = (await w.s.read(readStoredCustomGames, configurationSpaceId(w)))
    .current;
  if (game === null || game.status !== 'active')
    throw new Error('A side moved without a custom game under way');
  if (game[side].kind === 'bot') return;
  if (game.turn !== side)
    throw new Error(
      `The model lets ${side} move while ${game.turn} is to move; the sides take turns`
    );
  const device = connectedDevice(w, configurationName(w, game[side].person));
  if (device === null)
    throw new Error(`${side} has no connected device to move with`);
  await w.s.apply(
    makeCustomGameMove,
    device,
    modelGameOf(w).shared.id,
    nextModelMove(w, game)
  );
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

/** Bring `turn` to move with the side to move's next move, if it is not already. */
export async function configurationTurn(
  w: QuintHarnessWorld,
  turn: CustomGameSide,
  devices: { readonly white: string; readonly black: string }
): Promise<void> {
  const game = (await w.s.read(readStoredCustomGames, configurationSpaceId(w)))
    .current;
  if (game === null || game.turn === turn) return;
  await w.s.apply(playCustomGameHistory, {
    spaceId: configurationSpaceId(w),
    ...devices,
    moves: [nextModelMove(w, game)],
  });
}
