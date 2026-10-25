import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { check, hostSpace, tap } from './journey-gestures';
import type { JourneyHost } from './journey-types';
import {
  expectMultiplayerLoss,
  expectMultiplayerWin,
  prepareMultiplayerPair,
  tapFindOpponent,
} from './multiplayer-journey';
import { retirePreviousMultiplayer } from './multiplayer-search-recovery';
import {
  guidePongJourney,
  type PongJourneyStart,
  pongJourneyCourt,
  pongJourneyStart,
} from './pong-journey-court';

/** Fresh accounts find each other through the offered clock-free Pong choice. */
async function findPong(host: JourneyHost): Promise<PongJourneyStart> {
  await prepareMultiplayerPair(host);
  const find = async (ui: Driver) => {
    await hostSpace(ui);
    await tap(ui, 'game-menu-pong');
    await tap(ui, 'game-choice-multiplayer');
    await retirePreviousMultiplayer(ui);
    await tapFindOpponent(ui);
  };
  await host.act('findPongOpponent', find);
  await host.actAsGuest('findPongOpponent', find);
  let first: PongJourneyStart | null = null;
  await host.act('readPongAssignment', async (ui) => {
    first = await pongJourneyStart(ui);
  });
  check(first !== null, 'Alice has no Pong assignment');
  const start: PongJourneyStart = first;
  await host.actAsGuest('readPongAssignment', async (ui) => {
    const second = await pongJourneyStart(ui);
    check(
      second.gameId === start.gameId,
      'The people found different Pong games'
    );
    check(second.side !== start.side, 'Both people received the same paddle');
  });
  return start;
}

/** A natural target-score victory; no result fixture or resignation. */
export async function playPongJourney(
  host: JourneyHost
): Promise<PongJourneyStart> {
  const start = await findPong(host);
  const other = start.side === 'white' ? 'black' : 'white';
  const deadline = (await host.now()) + 90_000;
  while ((await host.now()) < deadline) {
    let finished = false;
    await host.act('guidePongBall', async (ui) => {
      finished = await guidePongJourney(ui, start.side, true);
    });
    if (finished) return start;
    await host.actAsGuest('guidePongBall', async (ui) => {
      await guidePongJourney(ui, other, false);
    });
    await host.elapse(50);
  }
  throw new Error('Pong did not reach its target score within 90 seconds');
}

export async function observePongVictory(
  host: JourneyHost,
  start: PongJourneyStart
): Promise<void> {
  let first: Awaited<ReturnType<typeof pongJourneyCourt>> | null = null;
  await host.act('observePongVictory', async (ui) => {
    await expectMultiplayerWin(ui);
    first = await pongJourneyCourt(ui);
    check(first.stage === 'finished', 'Pong did not finish');
    const side = start.side === 'white' ? 'left' : 'right';
    check(first.winner === side, 'Alice did not win Pong');
    check(
      first.score[side] === start.targetScore,
      'Pong ended before its target'
    );
  });
  await host.actAsGuest('observePongDefeat', async (ui) => {
    await expectMultiplayerLoss(ui);
    const second = await pongJourneyCourt(ui);
    check(
      second.stage === 'finished' && second.winner === first?.winner,
      'The people see different Pong winners'
    );
    check(
      JSON.stringify(second.score) === JSON.stringify(first?.score),
      'The people see different final Pong scores'
    );
  });
}
