import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import { type GameSide, gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  acceptPartyProgress,
  readPartyDevices,
} from './game-session-party-acceptance';
import {
  type PartyTurnProgress,
  playGameSessionPartyTurn,
  readPublicGameSession,
} from './game-session-party-turn';
import { takeBlack } from './game-session-readiness-wait';
import {
  check,
  endActiveSpace,
  hostSpace,
  JOURNEY_WAIT_MS,
  openGameSetupInSpace,
  tap,
} from './journey-gestures';
import type { JourneyHost } from './journey-types';
import { joinFromLink } from './space-gestures';

export type PublicGameSession = {
  readonly position: string;
  readonly status: string;
  readonly turn: GameSide;
  readonly outcome: string;
  readonly ply: number;
  readonly canMove: boolean;
};

async function createParty(ui: Driver, game: PlayableGame): Promise<void> {
  await openGameSetupInSpace(
    ui,
    game.shared.id,
    'vs-human',
    game.shared.registration?.rules.family
  );
  await ui
    .get('game-session-connection-needed')
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  await tap(ui, 'game-session-create');
  for (const side of gameSides(game.shared.turnGame.rules).slice(2)) {
    await tap(ui, `game-session-${side}-choices`);
    await tap(ui, `game-session-${side}-bot`);
    await ui
      .get(`game-session-${side}-person`)
      .expect.text('Bot', { exact: false, timeoutMs: JOURNEY_WAIT_MS });
  }
}

async function readyParty(host: JourneyHost): Promise<void> {
  let guestName = '';
  await host.actAsGuest('takeSecondSeat', async (ui) => {
    // A member with a seat open to them takes it from the lobby.
    await takeBlack(ui, 'game-session-take-seat');
    guestName =
      (await ui.get('game-session-black-person').text())?.trim() ?? '';
    check(guestName !== '', 'The second participant has no displayed name');
    await tap(ui, 'game-session-ready');
    await ui.get('game-session-ready').expect.text("I'm not ready", {
      exact: false,
      timeoutMs: JOURNEY_WAIT_MS,
    });
  });
  await host.act('startPartyGame', async (ui) => {
    await ui
      .get('game-session-black-person')
      .expect.text(guestName, { exact: false, timeoutMs: JOURNEY_WAIT_MS });
    await tap(ui, 'game-session-ready');
    await ui
      .get('game-session-startable')
      .expect.text('Ready to start.', { timeoutMs: JOURNEY_WAIT_MS });
    await tap(ui, 'game-session-start');
    // The game is under way once its board offers the game menu.
    await ui
      .get('game-session-commands')
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  });
}

export async function completeGameSessionParty(
  host: Pick<JourneyHost, 'act' | 'actAsGuest'>,
  game: PlayableGame
): Promise<PublicGameSession> {
  const sides = gameSides(game.shared.turnGame.rules);
  const progress: PartyTurnProgress = { returnedLiveAt: null, attempted: null };
  let acceptedPly = 0;
  for (let step = 0; step < 400; step++) {
    let view: PublicGameSession | undefined;
    await host.act('readPartyBoard', async (ui) => {
      if (acceptedPly > 0)
        await ui
          .get(`game-session-review-move-${acceptedPly}`)
          .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
      view = await readPublicGameSession(ui);
    });
    check(view !== undefined, 'The party game did not open');
    const current: PublicGameSession = view;
    if (current.status === 'completed') return current;
    check(current.status === 'active', 'The party game never started');
    const seat = sides.indexOf(current.turn);
    check(seat >= 0, 'The party game names a seat outside its roster');
    const before = await readPartyDevices(host);
    if (seat >= 2) {
      await host.act('awaitPartyBot', (ui) =>
        ui
          .get(`game-session-review-move-${current.ply + 1}`)
          .expect.visible({ timeoutMs: JOURNEY_WAIT_MS })
      );
      acceptedPly = current.ply + 1;
      await acceptPartyProgress(host, acceptedPly, before, null);
      continue;
    }
    const act = seat === 0 ? host.act : host.actAsGuest;
    await act('playPartyMove', async (ui) => {
      acceptedPly = await playGameSessionPartyTurn(ui, game, current, progress);
    });
    if (progress.attempted !== null)
      await acceptPartyProgress(host, acceptedPly, before, progress.attempted);
  }
  throw new Error('The party game did not finish within 400 accepted turns');
}

/** Two fresh people play, with bots occupying every additional declared seat. */
export async function playGameSessionPartyJourney(
  host: JourneyHost,
  game: PlayableGame
): Promise<PublicGameSession> {
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
  return completeGameSessionParty(host, game);
}

/** Both people observe exactly the same accepted board and terminal outcome. */
export async function observeGameSessionPartyJourney(
  host: JourneyHost,
  finished: PublicGameSession
): Promise<void> {
  const observe = async (ui: Driver): Promise<void> => {
    await ui
      .get(`game-session-review-move-${finished.ply}`)
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
    const view = await readPublicGameSession(ui);
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
