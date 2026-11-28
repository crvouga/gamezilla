import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  check,
  endActiveSpace,
  hostSpace,
  JOURNEY_WAIT_MS,
  openGameSetupInSpace,
  tap,
} from './journey-gestures';
import type { JourneyHost } from './journey-types';

type BotGame = {
  readonly id: string;
  /** The game's tile, for a mode other than the one its tile opens. */
  readonly family?: string;
  readonly seats: 2 | 3 | 4;
  readonly readyControl: string;
};

/** The named choices exercised by the start journeys, not a product registry. */
const CHOICES: Readonly<Record<string, BotGame>> = {
  Battleship: {
    id: 'battleship',
    seats: 2,
    readyControl: 'game-session-board-view-panels',
  },
  'Classic Quoridor': {
    id: 'quoridor',
    seats: 2,
    readyControl: 'game-session-board-action-e2',
  },
  Hearts: { id: 'hearts', seats: 4, readyControl: 'game-session-board-pass' },
  'Word Tiles': {
    id: 'word-tiles',
    seats: 2,
    readyControl: 'game-session-board-rack',
  },
  'Word Tiles for three': {
    id: 'word-tiles-3',
    family: 'word-tiles',
    seats: 3,
    readyControl: 'game-session-board-rack',
  },
  'Word Tiles for four': {
    id: 'word-tiles-4',
    family: 'word-tiles',
    seats: 4,
    readyControl: 'game-session-board-rack',
  },
  'Light Cycles Duel': {
    id: 'light-cycles',
    seats: 2,
    readyControl: 'game-session-board-arena',
  },
  'Light Cycles Trio': {
    id: 'light-cycles-3',
    family: 'light-cycles',
    seats: 3,
    readyControl: 'game-session-board-arena',
  },
  'Light Cycles Quad': {
    id: 'light-cycles-4',
    family: 'light-cycles',
    seats: 4,
    readyControl: 'game-session-board-arena',
  },
};

function choice(name: string): BotGame {
  const game = CHOICES[name];
  if (game === undefined) throw new Error(`No bot-start journey for ${name}`);
  return game;
}

/** Choose the named game and its bot shortcut from a fresh guest's space. */
export async function startBotGameJourney(
  host: JourneyHost,
  name: string
): Promise<void> {
  const game = choice(name);
  await host.open('anonymous');
  host.defer('bot-game-space', endActiveSpace);
  await host.act('hostBotGameSpace', hostSpace);
  await host.act('startChosenBotGame', async (ui) => {
    await openGameSetupInSpace(ui, game.id, 'vs-bot', game.family);
    await ui.get('game-session-connection-needed').expect.hidden({
      timeoutMs: JOURNEY_WAIT_MS,
    });
    await tap(ui, 'game-session-create');
    if (game.id === 'battleship') {
      await tap(ui, 'play-bots-setup-open');
      await tap(ui, 'game-session-setup-random');
    }
    await tap(ui, 'game-session-ready');
    await tap(ui, 'game-session-start');
  });
}

/** The playing surface is ready, with the declared other seats visibly held by bots. */
async function observeStartedGame(ui: Driver, game: BotGame): Promise<void> {
  await ui
    .get(game.readyControl)
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  // A game under way offers its commands (resigning among them) by one control.
  await ui
    .get('game-session-commands')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  const board = ui.get('game-session-board');
  await board.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  const box = await board.layout();
  check(
    box !== null && box.width > 0 && box.height > 0,
    'The game board has no size'
  );
  check(
    (await ui.get('game-session-public').attribute('data-status')) === 'active',
    'The chosen game is not under way'
  );
  const seats = ['white', 'black', 'red', 'blue'];
  for (const side of seats.slice(1, game.seats))
    await ui.get(`game-session-${side}`).expect.text('Bot', {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
  for (const side of seats.slice(game.seats))
    await ui.get(`game-session-${side}`).expect.hidden();
}

/** Observe the same named game's started state on the fresh guest's device. */
export async function observeBotGameJourney(
  host: Pick<JourneyHost, 'act'>,
  name: string
): Promise<void> {
  const game = choice(name);
  await host.act('observeChosenBotGame', (ui) => observeStartedGame(ui, game));
}
