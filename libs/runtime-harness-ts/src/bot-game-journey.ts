import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  check,
  endActiveSpace,
  hostSpace,
  JOURNEY_WAIT_MS,
  tap,
} from './journey-gestures';
import type { JourneyHost } from './journey-types';

type BotGame = {
  readonly id: string;
  readonly seats: 2 | 3 | 4;
  readonly readyControl: string;
};

/** The named choices exercised by the start journeys, not a product registry. */
const CHOICES: Readonly<Record<string, BotGame>> = {
  Hearts: { id: 'hearts', seats: 4, readyControl: 'custom-game-board-pass' },
  'Word Tiles': {
    id: 'word-tiles',
    seats: 2,
    readyControl: 'custom-game-board-rack',
  },
  'Word Tiles for three': {
    id: 'word-tiles-3',
    seats: 3,
    readyControl: 'custom-game-board-rack',
  },
  'Word Tiles for four': {
    id: 'word-tiles-4',
    seats: 4,
    readyControl: 'custom-game-board-rack',
  },
  'Light Cycles Duel': {
    id: 'light-cycles',
    seats: 2,
    readyControl: 'custom-game-board-arena',
  },
  'Light Cycles Trio': {
    id: 'light-cycles-3',
    seats: 3,
    readyControl: 'custom-game-board-arena',
  },
  'Light Cycles Quad': {
    id: 'light-cycles-4',
    seats: 4,
    readyControl: 'custom-game-board-arena',
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
    await tap(ui, Handles.gameMenu(game.id));
    await tap(ui, Handles.gameChoice('custom-game'));
    await ui.get('custom-game-connection-needed').expect.hidden({
      timeoutMs: JOURNEY_WAIT_MS,
    });
    await tap(ui, 'custom-game-play-bot');
  });
}

/** The playing surface is ready, with the declared other seats visibly held by bots. */
async function observeStartedGame(ui: Driver, game: BotGame): Promise<void> {
  await ui
    .get(game.readyControl)
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  await ui
    .get('custom-game-resign')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  const board = ui.get('custom-game-board');
  await board.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  const box = await board.layout();
  check(
    box !== null && box.width > 0 && box.height > 0,
    'The game board has no size'
  );
  check(
    (await ui.get('custom-game-public').attribute('data-status')) === 'active',
    'The chosen game is not under way'
  );
  const seats = ['white', 'black', 'red', 'blue'];
  for (const side of seats.slice(1, game.seats))
    await ui.get(`custom-game-${side}`).expect.text('Bot', {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
  for (const side of seats.slice(game.seats))
    await ui.get(`custom-game-${side}`).expect.hidden();
}

/** Observe the same named game's started state on the fresh guest's device. */
export async function observeBotGameJourney(
  host: Pick<JourneyHost, 'act'>,
  name: string
): Promise<void> {
  const game = choice(name);
  await host.act('observeChosenBotGame', (ui) => observeStartedGame(ui, game));
}
