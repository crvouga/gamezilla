import {
  contentAttribute,
  contentTap,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import type { PublishedJourneyPack } from '@libs/game-puzzle-harness-ts/content-journey-pack';
import {
  openJourneyAttempt,
  startJourneyAttempt,
} from '@libs/game-puzzle-harness-ts/content-journey-playing';
import {
  observeSokobanJourneyCounts,
  pushSokobanJourneyRight,
} from '@libs/sokoban-harness-ts/sokoban-journey-board';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { openContentSpace } from './content-library-navigation';
import { JOURNEY_WAIT_MS } from './journey-gestures';
import type { JourneyHost } from './journey-types';
import {
  beginSokobanAuthoring,
  publishSokobanPack,
} from './sokoban-authoring-journey';

export type SokobanContinuity = {
  readonly pack: PublishedJourneyPack;
  readonly link: string;
  readonly attemptId: string;
};

const device = (ui: Parameters<Parameters<JourneyHost['act']>[1]>[0]) => ({
  ui,
  timeoutMs: JOURNEY_WAIT_MS,
});
const guest = (host: JourneyHost) => ({
  openLink: host.openGuest,
  act: host.actAsGuest,
});

/** Bob starts the pack's first puzzle, pushes once, and closes the app. */
export async function playSokobanPartway(
  host: JourneyHost
): Promise<SokobanContinuity> {
  const pack = await publishSokobanPack(
    host,
    await beginSokobanAuthoring(host),
    'signed-in'
  );
  const link = await host.peerDevice.spaceLink();
  let attemptId = '';
  await host.actAsGuest('playSokobanPartway', async (ui) => {
    await contentTap(device(ui), 'content-pack-next');
    attemptId = await startJourneyAttempt(device(ui));
    await pushSokobanJourneyRight(device(ui));
    await observeSokobanJourneyCounts(device(ui), 1, 1);
    await contentTap(device(ui), Handles.navBack);
  });
  await host.peerDevice.reopen();
  return { pack, link, attemptId };
}

export async function continueSokobanOnOtherDevice(
  host: JourneyHost,
  kept: SokobanContinuity
): Promise<void> {
  await host.peerDevice.anotherSignedInDevice();
  await openContentSpace(guest(host), kept.link, 'sokoban');
  await host.actAsGuest('openSokobanAttemptOnOtherDevice', (ui) =>
    openJourneyAttempt(device(ui), kept.attemptId)
  );
}

export async function observeSokobanWhereStopped(
  host: JourneyHost,
  kept: SokobanContinuity
): Promise<void> {
  await host.actAsGuest('observeSokobanWhereStopped', async (ui) => {
    if (
      (await contentAttribute(
        device(ui),
        'content-attempt',
        'data-attemptid'
      )) !== kept.attemptId
    )
      throw new Error('The other device did not reopen the same attempt');
    await observeSokobanJourneyCounts(device(ui), 1, 1);
    const label = await ui.get('sokoban-board-tile-15').attribute('aria-label');
    if (label !== 'D3: floor, crate')
      throw new Error(`The crate is not where Bob left it: ${label}`);
  });
}

export async function finishSokobanPuzzle(host: JourneyHost): Promise<void> {
  await host.actAsGuest('finishSokobanPuzzle', async (ui) => {
    await pushSokobanJourneyRight(device(ui));
    await ui
      .get('content-attempt-complete')
      .expect.text('Puzzle completed', { ...device(ui), exact: false });
  });
}

export async function observeNextSokobanPuzzle(
  host: JourneyHost,
  kept: SokobanContinuity
): Promise<void> {
  const next = kept.pack.items[1];
  if (next === undefined) throw new Error('The pack has no second puzzle');
  await host.actAsGuest('observeNextSokobanPuzzle', (ui) =>
    ui
      .get('content-next-puzzle')
      .expect.text(next.title, { ...device(ui), exact: false })
  );
}
