import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { type GameSide, gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  check,
  endActiveSpace,
  hostSpace,
  JOURNEY_WAIT_MS,
  tap,
} from './journey-gestures';
import type { JourneyHost } from './journey-types';
import { joinFromLink } from './space-gestures';

export type PublicCustomGame = {
  readonly position: string;
  readonly status: string;
  readonly turn: GameSide;
  readonly outcome: string;
  readonly ply: number;
};

/** One rendered snapshot, so consecutive bot turns cannot tear the observation. */
async function publicGame(ui: Driver): Promise<PublicCustomGame> {
  const raw = await ui.get('custom-game-public').attribute('data-state');
  check(raw !== null, 'The custom game has no public board state');
  const value = JSON.parse(raw) as PublicCustomGame;
  check(
    typeof value.position === 'string' &&
      typeof value.status === 'string' &&
      typeof value.turn === 'string' &&
      typeof value.outcome === 'string' &&
      Number.isInteger(value.ply),
    'The public custom game is incomplete'
  );
  return value;
}

async function createParty(ui: Driver, game: PlayableGame): Promise<void> {
  await tap(ui, Handles.gameMenu(game.shared.id));
  await tap(ui, 'game-choice-custom-game');
  await ui
    .get('custom-game-connection-needed')
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  await tap(ui, 'custom-game-create');
  for (const side of gameSides(game.shared.turnGame.rules).slice(2)) {
    await tap(ui, `custom-game-${side}-choices`);
    await tap(ui, `custom-game-${side}-bot`);
    await ui
      .get(`custom-game-${side}-person`)
      .expect.text('Bot', { exact: false, timeoutMs: JOURNEY_WAIT_MS });
  }
}

async function readyParty(host: JourneyHost): Promise<void> {
  let guestName = '';
  await host.actAsGuest('takeSecondSeat', async (ui) => {
    await tap(ui, 'custom-game-black-claim');
    await ui
      .get('custom-game-black-release')
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
    guestName = (await ui.get('custom-game-black-person').text())?.trim() ?? '';
    check(guestName !== '', 'The second participant has no displayed name');
    await tap(ui, 'custom-game-ready');
    await ui.get('custom-game-ready').expect.text('Withdraw readiness', {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
  });
  await host.act('startPartyGame', async (ui) => {
    await ui
      .get('custom-game-black-person')
      .expect.text(guestName, { exact: false, timeoutMs: JOURNEY_WAIT_MS });
    await tap(ui, 'custom-game-ready');
    await ui
      .get('custom-game-startable')
      .expect.text('Ready to start.', { timeoutMs: JOURNEY_WAIT_MS });
    await tap(ui, 'custom-game-start');
    await ui
      .get('custom-game-resign')
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  });
}

async function completeParty(
  host: JourneyHost,
  game: PlayableGame
): Promise<PublicCustomGame> {
  const sides = gameSides(game.shared.turnGame.rules);
  for (let step = 0; step < 400; step++) {
    let view: PublicCustomGame | undefined;
    await host.act('readPartyBoard', async (ui) => {
      view = await publicGame(ui);
    });
    check(view !== undefined, 'The party game did not open');
    const current: PublicCustomGame = view;
    if (current.status === 'completed') return current;
    check(current.status === 'active', 'The party game never started');
    const seat = sides.indexOf(current.turn);
    check(seat >= 0, 'The party game names a seat outside its roster');
    if (seat >= 2) {
      await host.act('awaitPartyBot', (ui) =>
        ui
          .get(`custom-game-review-move-${current.ply + 1}`)
          .expect.visible({ timeoutMs: JOURNEY_WAIT_MS })
      );
      continue;
    }
    const act = seat === 0 ? host.act : host.actAsGuest;
    await act('playPartyMove', async (ui) => {
      if (current.ply > 0)
        await ui
          .get(`custom-game-review-move-${current.ply}`)
          .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
      const action = game.shared.automation.choose(
        current.position,
        () => 0.25
      );
      check(
        action !== null,
        'The active participant has no automated legal action'
      );
      await game.shared.automation.perform(ui, 'custom-game-board', action);
      await ui
        .get(`custom-game-review-move-${current.ply + 1}`)
        .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
    });
  }
  throw new Error('The party game did not finish within 400 accepted turns');
}

/** Two fresh people play, with bots occupying every additional declared seat. */
export async function playCustomGamePartyJourney(
  host: JourneyHost,
  game: PlayableGame
): Promise<PublicCustomGame> {
  check(
    game.shared.turnGame.rules.setup === undefined,
    'This party journey needs public positions'
  );
  await host.open('signed-in');
  await host.openPeer('signed-in');
  host.defer(`${game.shared.id}-party-space`, endActiveSpace);
  await host.act('hostPartySpace', hostSpace);
  await host.openGuest(await host.spaceLink());
  await host.actAsGuest('joinPartySpace', joinFromLink);
  await host.act('createPartyGame', (ui) => createParty(ui, game));
  await readyParty(host);
  return completeParty(host, game);
}

/** Both people observe exactly the same accepted board and terminal outcome. */
export async function observeCustomGamePartyJourney(
  host: JourneyHost,
  finished: PublicCustomGame
): Promise<void> {
  const observe = async (ui: Driver): Promise<void> => {
    await ui
      .get(`custom-game-review-move-${finished.ply}`)
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
    const view = await publicGame(ui);
    check(
      view.status === 'completed' &&
        view.position === finished.position &&
        view.outcome === finished.outcome &&
        view.outcome !== '',
      'The participants disagree on the completed party game'
    );
  };
  await host.act('observePartyResult', observe);
  await host.actAsGuest('observePartyResult', observe);
}
