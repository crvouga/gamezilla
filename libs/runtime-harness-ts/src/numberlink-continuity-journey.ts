import {
  type ContentJourneyDevice,
  contentAttribute,
  contentTap,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import type { PublishedJourneyPack } from '@libs/game-puzzle-harness-ts/content-journey-pack';
import {
  openJourneyAttempt,
  restartJourneyAttempt,
  startJourneyAttempt,
  waitForJourneyPosition,
} from '@libs/game-puzzle-harness-ts/content-journey-playing';
import {
  drawNumberlinkJourneyRow,
  observeNumberlinkJourneyRow,
} from '@libs/numberlink-harness-ts/numberlink-journey-board';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { JOURNEY_WAIT_MS } from './journey-gestures';
import type { JourneyHost } from './journey-types';
import { authorNumberlinkJourney } from './numberlink-authoring-journey';
import { openNumberlinkSpace } from './numberlink-journey-navigation';

export type NumberlinkContinuity = {
  pack: PublishedJourneyPack;
  attemptId: string;
};

async function beginAndKeep(device: ContentJourneyDevice): Promise<string> {
  await contentTap(device, 'content-pack-next');
  const id = await startJourneyAttempt(device);
  await drawNumberlinkJourneyRow(device, 0);
  await contentTap(device, 'content-undo');
  await waitForJourneyPosition(device);
  await observeNumberlinkJourneyRow(device, 0, false);
  await contentTap(device, 'content-redo');
  await waitForJourneyPosition(device);
  await observeNumberlinkJourneyRow(device, 0, true);
  const restarted = await restartJourneyAttempt(device);
  if (restarted === id)
    throw new Error('Restart did not create another personal attempt');
  await observeNumberlinkJourneyRow(device, 0, false);
  await contentTap(device, Handles.navBack);
  await openJourneyAttempt(device, id);
  await observeNumberlinkJourneyRow(device, 0, true);
  await contentTap(device, Handles.navBack);
  return id;
}

async function finishAndContinue(
  device: ContentJourneyDevice,
  id: string,
  pack: PublishedJourneyPack
): Promise<string> {
  await openJourneyAttempt(device, id);
  await observeNumberlinkJourneyRow(device, 0, true);
  await drawNumberlinkJourneyRow(device, 1);
  await drawNumberlinkJourneyRow(device, 2);
  await device.ui
    .get('content-attempt-complete')
    .expect.text('Puzzle completed', { ...device, exact: false });
  await contentTap(device, 'content-next-puzzle');
  const next = await startJourneyAttempt(device);
  await drawNumberlinkJourneyRow(device, 0);
  await contentTap(device, 'content-return-pack');
  await device.ui
    .get('content-pack-progress')
    .expect.text('1 of 2 puzzles completed', device);
  await device.ui
    .get('content-pack-next')
    .expect.text(`Continue ${pack.items[1]!.title}`, device);
  await contentTap(device, 'content-pack-next');
  await contentTap(device, 'content-continue-attempt');
  return next;
}

export async function continueNumberlinkAcrossDevices(
  host: JourneyHost
): Promise<NumberlinkContinuity> {
  const pack = await authorNumberlinkJourney(host, 'signed-in');
  const link = await host.peerDevice.spaceLink();
  let id = '';
  await host.actAsGuest('beginAndKeepNumberlink', async (ui) => {
    id = await beginAndKeep({ ui, timeoutMs: JOURNEY_WAIT_MS });
  });
  await host.peerDevice.reopen();
  const guest = { openLink: host.openGuest, act: host.actAsGuest };
  await openNumberlinkSpace(guest, link);
  await host.actAsGuest('resumeNumberlinkAfterClosingApp', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    await openJourneyAttempt(device, id);
    await observeNumberlinkJourneyRow(device, 0, true);
  });
  await host.peerDevice.anotherSignedInDevice();
  await openNumberlinkSpace(guest, link);
  let attemptId = '';
  await host.actAsGuest(
    'completeAndContinueNumberlinkOnAnotherDevice',
    async (ui) => {
      attemptId = await finishAndContinue(
        { ui, timeoutMs: JOURNEY_WAIT_MS },
        id,
        pack
      );
    }
  );
  return { pack, attemptId };
}

export async function observeNumberlinkContinuity(
  host: JourneyHost,
  kept: NumberlinkContinuity
): Promise<void> {
  await host.actAsGuest('observeKeptNumberlinkAttempt', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    if (
      (await contentAttribute(device, 'content-attempt', 'data-attemptid')) !==
      kept.attemptId
    )
      throw new Error(
        'Continuing the pack did not reopen its unfinished attempt'
      );
    await observeNumberlinkJourneyRow(device, 0, true);
    await ui.get('content-return-pack').wait('enabled', device);
  });
}
