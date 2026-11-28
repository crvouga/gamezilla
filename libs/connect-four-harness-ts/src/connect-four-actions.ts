import { decodeConnectFour } from '@libs/connect-four-shared-ts/connect-four';
import type { GameSessionSeat } from '@libs/game-session-harness-ts/game-session-lineup';
import { establishGameSession } from '@libs/game-session-harness-ts/game-session-lineup';
import {
  GAME_SESSION_BOARD,
  playOnGameSessionBoard,
} from '@libs/game-session-harness-ts/game-session-moves';
import { readGameSessionScreen } from '@libs/game-session-harness-ts/game-session-screen';
import { chooseGameSession } from '@libs/game-session-harness-ts/game-session-ui';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';

const COLUMNS = 7;
const CELLS = 42;
const column = (index: number) => `${GAME_SESSION_BOARD}-column-${index + 1}`;

/** A Connect Four game session by its sides' disc colours and its drops. */
export type ConnectFourSetup = {
  readonly host?: string;
  readonly red?: GameSessionSeat;
  readonly yellow?: GameSessionSeat;
  readonly ready?: boolean;
  readonly active?: boolean;
  readonly moves?: readonly number[];
  readonly watchers?: readonly string[];
};

/** The shared game-session lineup, in Connect Four's own words. */
export const establishConnectFour = scenarioAction({
  name: 'establishConnectFour',
  act: async (s, options: ConnectFourSetup = {}) => {
    await Promise.resolve(
      establishGameSession.act(s, 'connect-four', {
        ...(options.host === undefined ? {} : { host: options.host }),
        ...(options.red === undefined ? {} : { first: options.red }),
        ...(options.yellow === undefined ? {} : { second: options.yellow }),
        ...(options.ready === undefined ? {} : { ready: options.ready }),
        ...(options.active === undefined ? {} : { active: options.active }),
        ...(options.watchers === undefined
          ? {}
          : { watchers: options.watchers }),
        moves: (options.moves ?? []).map(String),
      })
    );
  },
});

/** Drop into a column as a person does: its control when offered, else by choosing it. */
export const dropConnectFour = scenarioAction({
  name: 'dropConnectFour',
  act: async (s, actor: string, index: number, keyboard = false) => {
    const ui = await actorUi(s, actor);
    const game = (await readGameSessionScreen(s, actor))?.current;
    if (game === null || game === undefined)
      throw new Error('No Connect Four game');
    const target = ui.get(column(index));
    if (
      Number.isInteger(index) &&
      index >= 0 &&
      index < COLUMNS &&
      (await target.attribute('aria-disabled')) === 'false'
    ) {
      await playOnGameSessionBoard(s, actor, async () => {
        if (keyboard) await target.key('enter');
        else await target.tap();
        return 'made';
      });
      return;
    }
    await chooseGameSession(s, actor, {
      operation: 'move',
      uci: String(index),
      ply: game.moves.length,
    });
  },
});

/** A positive interaction that must reach the actual column control. */
export const clickConnectFourColumn = scenarioAction({
  name: 'clickConnectFourColumn',
  act: async (s, actor: string, index: number) => {
    const ui = await actorUi(s, actor);
    await playOnGameSessionBoard(s, actor, async () => {
      await ui.get(column(index)).tap();
      return 'made';
    });
  },
});

/** Move the keyboard preview onto a column without dropping. */
export const previewConnectFour = scenarioAction({
  name: 'previewConnectFour',
  act: async (s, actor: string, index: number) => {
    const ui = await actorUi(s, actor);
    await ui.get(column(index)).key('arrowRight');
    await ui.key('arrowLeft');
  },
});

export const preferConnectFourReducedMotion = scenarioAction({
  name: 'preferConnectFourReducedMotion',
  act: async (s, actor: string) => {
    await s.actors.get(actor)!.device.setReducedMotion(true);
  },
});

/** The Connect Four board `actor` sees, decoded from what is rendered. */
export async function connectFourView(s: ProductHarness, actor = 'alice') {
  const screen = await readGameSessionScreen(s, actor);
  if (screen?.current === undefined || screen.current === null)
    throw new Error('No Connect Four board');
  const ui = await actorUi(s, actor);
  const cells = await ui.get(GAME_SESSION_BOARD).attribute('data-cells');
  let winningShown = 0;
  for (let cell = 0; cell < CELLS; cell++) {
    if (
      (await ui
        .get(`${GAME_SESSION_BOARD}-cell-${cell}`)
        .attribute('data-winning')) === 'true'
    )
      winningShown += 1;
  }
  return {
    ...screen,
    winningShown,
    board: cells === null ? [] : (JSON.parse(cells) as number[]),
    game: decodeConnectFour(screen.position),
    preview: Number(
      await ui.get(GAME_SESSION_BOARD).attribute('data-preview-cell')
    ),
  };
}

/** How one column presents itself to someone following the board. */
export async function connectFourColumn(
  s: ProductHarness,
  actor: string,
  index: number
) {
  const node = (await actorUi(s, actor)).get(column(index));
  return {
    full: await node.attribute('data-full'),
    disabled: await node.attribute('aria-disabled'),
    label: await node.attribute('aria-label'),
  };
}

export async function connectFourStatus(s: ProductHarness, actor: string) {
  return (await actorUi(s, actor)).get('game-session-status').text();
}

export async function connectFourBoardDescription(
  s: ProductHarness,
  actor: string
) {
  return (await actorUi(s, actor)).get(GAME_SESSION_BOARD).text();
}

export const CONNECT_FOUR_ACTIONS = [
  establishConnectFour,
  dropConnectFour,
  clickConnectFourColumn,
  previewConnectFour,
  preferConnectFourReducedMotion,
];
