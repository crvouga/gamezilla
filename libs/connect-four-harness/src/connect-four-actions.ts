import { decodeConnectFour } from '@libs/connect-four-shared/connect-four';
import {
  chooseCustomGame,
  configureCustomGame,
  readCustomGameProbe,
  waitCustomGameSettled,
} from '@libs/game-session-harness/custom-game-ui';
import type { CustomGameInput } from '@libs/game-session-shared/custom-game-choice';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { backToTabs } from '@libs/harness/shell-actions';
import {
  createSpace,
  joinFromPrompt,
  openSpaceLink,
} from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';

async function openConnectFourCustom(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const ui = await actorUi(s, actor);
  await ui.get('connect-four-custom').expect.visible();
  await ui.get('connect-four-custom').tap();
  await ui.get('chess-custom-status').expect.visible();
}
export type ConnectFourSetup = {
  readonly host?: string;
  readonly red?: string | 'bot';
  readonly yellow?: string | 'bot' | 'open';
  readonly ready?: boolean;
  readonly active?: boolean;
  readonly moves?: readonly number[];
  readonly watchers?: readonly string[];
};
async function configureParticipant(
  s: ProductHarness,
  options: { host: string; side: 'white' | 'black'; person: string }
): Promise<void> {
  const { host, side, person } = options;
  if (person === 'open') return;
  if (person === 'bot') {
    await configureCustomGame(s, host, { operation: 'bot', side });
    return;
  }
  if (person === host) {
    await configureCustomGame(s, host, { operation: 'take', side });
    return;
  }
  const id = (await readCustomGameProbe(s, person))?.myId;
  if (!id) throw new Error(`No identity for ${person}`);
  await configureCustomGame(s, host, { operation: 'invite', side, person: id });
  await configureCustomGame(s, person, { operation: 'accept', side });
}
async function playFixture(
  s: ProductHarness,
  options: {
    host: string;
    red: string;
    yellow: string;
    moves: readonly number[];
  }
): Promise<void> {
  for (const column of options.moves) {
    const game = (await readCustomGameProbe(s, options.host))?.current;
    if (game === null || game === undefined) throw new Error('No game');
    await configureCustomGame(
      s,
      game.turn === 'white' ? options.red : options.yellow,
      { operation: 'move', uci: String(column), ply: game.moves.length }
    );
  }
}
/** Preconditions use ordinary room choices, never inject a board or its winner. */
export const establishConnectFour = scenarioAction({
  name: 'establishConnectFour',
  act: async (s, options: ConnectFourSetup = {}) => {
    const host = options.host ?? 'alice';
    const red = options.red ?? 'alice';
    const yellow = options.yellow ?? 'bob';
    const people = [
      ...new Set([host, red, yellow, ...(options.watchers ?? [])]),
    ].filter((p) => p !== 'bot' && p !== 'open');
    for (const person of people) {
      await Promise.resolve(signInWithGoogle.act(s, person));
      await Promise.resolve(backToTabs.act(s, person));
    }
    await Promise.resolve(createSpace.act(s, host));
    const link = await readSpaceLink(s, host);
    if (link === null) throw new Error('Connect Four host has no space');
    await (await actorUi(s, host)).get('game-menu-connect-four').tap();
    await openConnectFourCustom(s, host);
    for (const person of people.filter((p) => p !== host)) {
      // regression: connect-four-fixture-before-space-join
      await Promise.resolve(openSpaceLink.act(s, person, link));
      await (await actorUi(s, person)).get('space-join').expect.visible();
      await Promise.resolve(joinFromPrompt.act(s, person));
      await openConnectFourCustom(s, person);
    }
    await configureCustomGame(s, host, { operation: 'create' });
    await configureCustomGame(s, host, { operation: 'open', side: 'white' });
    await configureParticipant(s, { host, side: 'white', person: red });
    await configureParticipant(s, { host, side: 'black', person: yellow });
    // Configuring either side withdraws all readiness, so agree to the final lineup.
    if (options.ready !== false)
      for (const person of [red, yellow]) {
        if (person !== 'bot' && person !== 'open')
          await configureCustomGame(s, person, { operation: 'ready' });
      }
    if (options.active !== false)
      await configureCustomGame(s, host, { operation: 'start' });
    await playFixture(s, { host, red, yellow, moves: options.moves ?? [] });
  },
});
export const dropConnectFour = scenarioAction({
  name: 'dropConnectFour',
  act: async (s, actor: string, column: number, keyboard = false) => {
    const ui = await actorUi(s, actor);
    const probe = await readCustomGameProbe(s, actor);
    const game = probe?.current;
    if (probe === null || game === null || game === undefined)
      throw new Error('No Connect Four game');
    if (!Number.isInteger(column) || column < 0 || column >= 7) {
      await chooseCustomGame(s, actor, {
        operation: 'move',
        uci: String(column),
        ply: game.moves.length,
      });
      return;
    }
    const target = ui.get(`connect-four-column-${column + 1}`);
    if ((await target.attribute('aria-disabled')) === 'false') {
      if (keyboard) await target.key('enter');
      else await target.tap();
      await waitCustomGameSettled(s, actor, probe.settled);
    } else
      await chooseCustomGame(s, actor, {
        operation: 'move',
        uci: String(column),
        ply: game.moves.length,
      });
  },
});
/** A normal positive interaction must reach the actual board control. */
export const clickConnectFourColumn = scenarioAction({
  name: 'clickConnectFourColumn',
  act: async (s, actor: string, column: number) => {
    const ui = await actorUi(s, actor);
    const before = await readCustomGameProbe(s, actor);
    if (before === null) throw new Error('No Connect Four game');
    await ui.get(`connect-four-column-${column + 1}`).tap();
    await waitCustomGameSettled(s, actor, before.settled);
  },
});
export const chooseConnectFour = scenarioAction({
  name: 'chooseConnectFour',
  act: async (s, actor: string, input: CustomGameInput) => {
    await chooseCustomGame(s, actor, input);
  },
});
export const previewConnectFour = scenarioAction({
  name: 'previewConnectFour',
  act: async (s, actor: string, column: number) => {
    const ui = await actorUi(s, actor);
    await ui.get(`connect-four-column-${column + 1}`).key('arrowRight');
    await ui.key('arrowLeft');
  },
});
export async function connectFourView(s: ProductHarness, actor = 'alice') {
  const probe = await readCustomGameProbe(s, actor);
  if (probe?.current === undefined || probe.current === null)
    throw new Error('No Connect Four board');
  const ui = await actorUi(s, actor);
  const cells = await ui.get('connect-four-board').attribute('data-cells');
  const highlights = await Promise.all(
    Array.from({ length: 42 }, (_, cell) =>
      ui.get(`connect-four-board-cell-${cell}`).attribute('data-winning')
    )
  );
  const winningShown = highlights.filter((value) => value === 'true').length;
  return {
    ...probe,
    winningShown,
    board: cells === null ? [] : (JSON.parse(cells) as number[]),
    game: decodeConnectFour(probe.displayFen),
    preview: Number(
      await ui.get('connect-four-board').attribute('data-preview-cell')
    ),
  };
}
export const CONNECT_FOUR_ACTIONS = [
  establishConnectFour,
  dropConnectFour,
  chooseConnectFour,
  previewConnectFour,
];
