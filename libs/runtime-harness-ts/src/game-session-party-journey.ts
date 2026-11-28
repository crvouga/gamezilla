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
    'vs-bot',
    game.shared.registration?.rules.family
  );
  await ui
    .get('game-session-connection-needed')
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  await tap(ui, 'game-session-create');
}

async function readyParty(host: JourneyHost): Promise<void> {
  await host.act('startPartyGame', async (ui) => {
    await tap(ui, 'game-session-ready');
    await tap(ui, 'game-session-start');
    // The game is under way once its board offers the game menu.
    await ui
      .get('game-session-commands')
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  });
}

export async function completeGameSessionParty(
  host: Pick<JourneyHost, 'act' | 'actAsGuest'>,
  game: PlayableGame,
  humanSeats = 2
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
    if (seat >= humanSeats) {
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

/** One person plays bots while a second device watches. */
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
  return completeGameSessionParty(host, game, 1);
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
