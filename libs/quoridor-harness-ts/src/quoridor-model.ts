import {
  CUSTOM_GAME_BOARD,
  playOnCustomGameBoard,
} from '@libs/game-session-harness-ts/custom-game-moves';
import { chooseCustomGame } from '@libs/game-session-harness-ts/custom-game-ui';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { QuoridorMode } from '@libs/quoridor-shared-ts/quoridor';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { establishQuoridor, quoridorView } from './quoridor-actions';

export const QUORIDOR_ACTORS = ['alice', 'bob', 'carol', 'dave'] as const;

export const establishQuoridorModel = scenarioAction({
  name: 'establishQuoridorModel',
  act: (s, mode: QuoridorMode, beginning: string) =>
    establishQuoridor.act(s, {
      mode,
      ...(beginning === 'start' ? {} : { fixture: `${mode}-model-near` }),
    }),
});

export const placeQuoridorModelWall = scenarioAction({
  name: 'placeQuoridorModelWall',
  act: async (
    s,
    placement: {
      readonly player: number;
      readonly column: number;
      readonly row: number;
      readonly direction: number;
    }
  ) => {
    const { player, column, row, direction } = placement;
    const actor = QUORIDOR_ACTORS[player]!;
    const view = await quoridorView(s, actor);
    await chooseCustomGame(s, actor, {
      operation: 'move',
      uci: `${String.fromCharCode(97 + column)}${row + 1}${direction === 0 ? 'h' : 'v'}`,
      ply: view.current!.moves.length,
    });
  },
});

export const passQuoridorTurn = scenarioAction({
  name: 'passQuoridorTurn',
  act: async (s, actor: string) => {
    const view = await quoridorView(s, actor);
    const ui = await actorUi(s, actor);
    const pass = ui.get(`${CUSTOM_GAME_BOARD}-action-pass`);
    if (view.mySide === view.current?.turn && (await pass.isVisible())) {
      await playOnCustomGameBoard(s, actor, async () => {
        await pass.key('enter');
        return 'made';
      });
    } else
      await chooseCustomGame(s, actor, {
        operation: 'move',
        uci: 'pass',
        ply: view.current!.moves.length,
      });
  },
});

/** Decode only what the board and its player inventory show. */
export async function quoridorModelState(s: ProductHarness) {
  const view = await quoridorView(s);
  return {
    mode: view.game.mode,
    pawns: new Map<QuintValue, QuintValue>(
      view.game.pawns.map((cell, player) => [player, cell])
    ),
    remaining: new Map<QuintValue, QuintValue>(
      view.game.remaining.map((count, player) => [player, count])
    ),
    walls: new Set<QuintValue>(
      view.game.walls.map((wall) => [
        wall.charCodeAt(0) - 97,
        Number(wall[1]) - 1,
        wall[2] === 'h' ? 0 : 1,
      ])
    ),
    turn: view.game.turn,
    winner: view.game.winner ?? -1,
  };
}

export const QUORIDOR_MODEL_ACTIONS = [
  establishQuoridorModel,
  placeQuoridorModelWall,
  passQuoridorTurn,
];
