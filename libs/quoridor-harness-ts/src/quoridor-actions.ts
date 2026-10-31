import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import {
  CUSTOM_GAME_BOARD,
  customGameBoardTakes,
  playOnCustomGameBoard,
} from '@libs/game-session-harness-ts/custom-game-moves';
import { readCustomGameScreen } from '@libs/game-session-harness-ts/custom-game-screen';
import { chooseCustomGame } from '@libs/game-session-harness-ts/custom-game-ui';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  decodeQuoridor,
  type QuoridorMode,
  quoridorCellName,
} from '@libs/quoridor-shared-ts/quoridor';
import { QUORIDOR_POSITIONS } from './quoridor-fixtures';

export type QuoridorSetup = {
  readonly mode?: QuoridorMode;
  readonly fixture?: string;
  readonly moves?: readonly string[];
  readonly active?: boolean;
  readonly watchers?: readonly string[];
  readonly first?: string;
};

export const establishQuoridor = scenarioAction({
  name: 'establishQuoridor',
  act: (s, options: QuoridorSetup = {}) =>
    establishCustomGame.act(
      s,
      options.mode === 'hill' ? 'quoridor-hill' : 'quoridor',
      {
        ...(options.active === undefined ? {} : { active: options.active }),
        ...(options.watchers === undefined
          ? {}
          : { watchers: options.watchers }),
        ...(options.first === undefined ? {} : { first: options.first }),
        moves: options.moves ?? QUORIDOR_POSITIONS[options.fixture ?? ''] ?? [],
      }
    ),
});

export const moveQuoridorPawn = scenarioAction({
  name: 'moveQuoridorPawn',
  act: async (s, actor: string, cell: string, keyboard = false) => {
    const ui = await actorUi(s, actor);
    const screen = await readCustomGameScreen(s, actor);
    if (screen?.current == null) throw new Error('No Quoridor game');
    if (screen.current.status === 'active')
      await ui.get(`${CUSTOM_GAME_BOARD}-mode-move`).key('enter');
    const target = ui.get(`${CUSTOM_GAME_BOARD}-action-${cell}`);
    if (
      (await customGameBoardTakes(s, actor, cell)) &&
      (await target.attribute('aria-disabled')) === 'false'
    ) {
      await playOnCustomGameBoard(s, actor, async () => {
        if (keyboard) await target.key('enter');
        else await target.tap();
        return 'made';
      });
    } else
      await chooseCustomGame(s, actor, {
        operation: 'move',
        uci: cell,
        ply: screen.current.moves.length,
      });
  },
});

export const placeQuoridorWall = scenarioAction({
  name: 'placeQuoridorWall',
  act: async (
    s,
    actor: string,
    placement: {
      readonly orientation: string;
      readonly cell: string;
      readonly keyboard?: boolean;
    }
  ) => {
    const { orientation, cell, keyboard } = placement;
    const ui = await actorUi(s, actor);
    const suffix = orientation === 'horizontal' ? 'h' : 'v';
    const action = `${cell}${suffix}`;
    const screen = await readCustomGameScreen(s, actor);
    if (screen?.current == null) throw new Error('No Quoridor game');
    if (screen.current.status !== 'active') {
      await chooseCustomGame(s, actor, {
        operation: 'move',
        uci: action,
        ply: screen.current.moves.length,
      });
      return;
    }
    await ui.get(`${CUSTOM_GAME_BOARD}-mode-${suffix}`).key('enter');
    const target = ui.get(`${CUSTOM_GAME_BOARD}-action-${action}`);
    if (await customGameBoardTakes(s, actor, action)) {
      await playOnCustomGameBoard(s, actor, async () => {
        if (keyboard) await target.key('enter');
        else await target.tap();
        return 'made';
      });
    } else {
      await target.key('arrowRight');
      await target.key('arrowLeft');
      if (keyboard) await target.key('enter');
      else await target.tap();
      await s.session.waitForIdle();
    }
  },
});

export const preferQuoridorReducedMotion = scenarioAction({
  name: 'preferQuoridorReducedMotion',
  act: (s, actor: string) => s.actors.get(actor)!.device.setReducedMotion(true),
});

/** The board's rendered pieces, boundaries, player names and wall status. */
export async function quoridorView(s: ProductHarness, actor = 'alice') {
  const screen = await readCustomGameScreen(s, actor);
  if (screen?.current == null) throw new Error('No Quoridor board');
  const game = decodeQuoridor(screen.position);
  const ui = await actorUi(s, actor);
  const suffix = await quoridorToolSuffix((id) => ui.get(id).isVisible());
  const pawnLabels: string[] = [];
  for (const cell of game.pawns) {
    pawnLabels.push(
      (await ui
        .get(`${CUSTOM_GAME_BOARD}-action-${quoridorCellName(cell)}${suffix}`)
        .attribute('aria-label')) ?? ''
    );
  }
  return {
    ...screen,
    game,
    pawnLabels,
    boardLabel: await ui.get(CUSTOM_GAME_BOARD).attribute('aria-label'),
    wallStatus: await ui.get(`${CUSTOM_GAME_BOARD}-wall-status`).text(),
  };
}

export async function quoridorWallEdges(s: ProductHarness, cell: string) {
  const ui = await actorUi(s, 'alice');
  const suffix = await quoridorToolSuffix((id) => ui.get(id).isVisible());
  const target = ui.get(`${CUSTOM_GAME_BOARD}-action-${cell}${suffix}`);
  return {
    top: await target.attribute('data-edge-top'),
    right: await target.attribute('data-edge-right'),
  };
}

/** The rendered cells keep their namespace even when the action bar is absent. */
export async function quoridorToolSuffix(
  isVisible: (testId: string) => Promise<boolean>
): Promise<string> {
  if (await isVisible(`${CUSTOM_GAME_BOARD}-action-a1h`)) return 'h';
  return (await isVisible(`${CUSTOM_GAME_BOARD}-action-a1v`)) ? 'v' : '';
}

export const QUORIDOR_ACTIONS = [
  establishQuoridor,
  moveQuoridorPawn,
  placeQuoridorWall,
  preferQuoridorReducedMotion,
];
