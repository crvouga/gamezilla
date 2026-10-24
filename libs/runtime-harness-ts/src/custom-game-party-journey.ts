import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { type GameSide, gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  playCustomGamePartyTurn,
  readPublicCustomGame,
} from './custom-game-party-turn';
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
  readonly canMove: boolean;
};

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

export async function completeCustomGameParty(
  host: Pick<JourneyHost, 'act' | 'actAsGuest'>,
  game: PlayableGame
): Promise<PublicCustomGame> {
  const sides = gameSides(game.shared.turnGame.rules);
  const progress = { returnedLiveAt: null as number | null };
  let acceptedPly = 0;
  for (let step = 0; step < 400; step++) {
    let view: PublicCustomGame | undefined;
    await host.act('readPartyBoard', async (ui) => {
      if (acceptedPly > 0)
        await ui
          .get(`custom-game-review-move-${acceptedPly}`)
          .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
      view = await readPublicCustomGame(ui);
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
      acceptedPly = current.ply + 1;
      continue;
    }
    const act = seat === 0 ? host.act : host.actAsGuest;
    await act('playPartyMove', async (ui) => {
      acceptedPly = await playCustomGamePartyTurn(ui, game, current, progress);
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
  return completeCustomGameParty(host, game);
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
    const view = await readPublicCustomGame(ui);
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
