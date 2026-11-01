import {
  contentAttribute,
  contentTap,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import { discoverJourneyContent } from '@libs/game-puzzle-harness-ts/content-journey-discovery';
import {
  observeJourneyPack,
  type PublishedJourneyPack,
} from '@libs/game-puzzle-harness-ts/content-journey-pack';
import {
  createJourneyPackWithPuzzle,
  type JourneyPackDraft,
} from '@libs/game-puzzle-harness-ts/content-journey-pack-draft';
import {
  openJourneyAttempt,
  startJourneyAttempt,
} from '@libs/game-puzzle-harness-ts/content-journey-playing';
import {
  NUMBERLINK_JOURNEY_BOARD,
  observeNumberlinkJourneyRow,
} from '@libs/numberlink-harness-ts/numberlink-journey-board';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { JOURNEY_WAIT_MS } from './journey-gestures';
import type { JourneyHost } from './journey-types';
import { authorNumberlinkJourney } from './numberlink-authoring-journey';
import { openNumberlinkSpace } from './numberlink-journey-navigation';
import {
  publishOfflineNumberlinkDraft,
  reopenOfflineNumberlinkDraft,
} from './numberlink-offline-authoring';

export type NumberlinkOfflineJourney = {
  draft: JourneyPackDraft;
  attemptId: string;
};

async function authorWhileOffline(
  host: JourneyHost,
  pack: PublishedJourneyPack,
  owned: string[]
): Promise<JourneyPackDraft> {
  let draft: JourneyPackDraft | undefined;
  await host.act('authorNumberlinkWithoutConnection', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    await ui.get('content-offline').expect.visible(device);
    await contentTap(device, Handles.navBack);
    draft = await createJourneyPackWithPuzzle({
      device,
      title: `Offline trails ${host.runId}`,
      puzzleTitle: `Meadow ${host.runId}`,
      existing: pack.items[0]!,
      board: NUMBERLINK_JOURNEY_BOARD,
      backId: Handles.navBack,
      onCreated: (id) => {
        owned.push(id);
      },
    });
  });
  if (draft === undefined)
    throw new Error('The offline working pack was not created');
  return draft;
}

async function playWhileOffline(
  host: JourneyHost,
  link: string
): Promise<string> {
  let attemptId = '';
  await host.actAsGuest(
    'playAvailableNumberlinkWithoutConnection',
    async (ui) => {
      const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
      await ui.get('content-offline').expect.visible(device);
      await contentTap(device, 'content-pack-next');
      attemptId = await startJourneyAttempt(device);
      await NUMBERLINK_JOURNEY_BOARD.solve(device);
      await ui
        .get('content-attempt-complete')
        .expect.text('Puzzle completed', { ...device, exact: false });
    }
  );
  await host.peerDevice.reopen();
  await openNumberlinkSpace(
    { openLink: host.openGuest, act: host.actAsGuest },
    link
  );
  await host.actAsGuest('reopenNumberlinkWithoutConnection', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    await ui.get('content-offline').expect.visible(device);
    await openJourneyAttempt(device, attemptId);
    await ui
      .get('content-attempt-complete')
      .expect.text('Puzzle completed', { ...device, exact: false });
  });
  return attemptId;
}

export async function keepNumberlinkOfflineWork(
  host: JourneyHost
): Promise<NumberlinkOfflineJourney> {
  const owned: string[] = [];
  const available = await authorNumberlinkJourney(host, 'signed-in', owned);
  const hostLink = await host.spaceLink();
  const peerLink = await host.peerDevice.spaceLink();
  await host.actAsGuest('observeAvailableNumberlinkBeforeDisconnecting', (ui) =>
    observeJourneyPack({ ui, timeoutMs: JOURNEY_WAIT_MS }, available)
  );
  await host.offline();
  await host.peerDevice.offline();
  const draft = await authorWhileOffline(host, available, owned);
  const attemptId = await playWhileOffline(host, peerLink);
  await reopenOfflineNumberlinkDraft(host, hostLink, draft);
  await host.online();
  await host.peerDevice.online();
  const published = await publishOfflineNumberlinkDraft(host, draft);
  await host.peerDevice.anotherSignedInDevice();
  await openNumberlinkSpace(
    { openLink: host.openGuest, act: host.actAsGuest },
    peerLink
  );
  await host.actAsGuest('discoverReconnectedNumberlinkWork', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    await discoverJourneyContent(
      { ui, timeoutMs: JOURNEY_WAIT_MS },
      published.revisionId
    );
    await observeJourneyPack(device, published, 1);
    await contentTap(
      device,
      `content-pack-puzzle-${published.items[0]!.revisionId}`
    );
    await NUMBERLINK_JOURNEY_BOARD.preview(device);
    await contentTap(device, Handles.navBack);
    await contentTap(device, Handles.navBack);
    await openJourneyAttempt(device, attemptId);
  });
  return { draft, attemptId };
}

export async function observeKeptOfflineNumberlink(
  host: JourneyHost,
  kept: NumberlinkOfflineJourney
): Promise<void> {
  await host.act('observeKeptOfflineNumberlinkDraft', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    if (
      (await contentAttribute(device, 'content-author', 'data-documentid')) !==
      kept.draft.puzzleId
    )
      throw new Error('The offline puzzle draft lost its identity');
    await ui
      .get('content-author')
      .expect.text(kept.draft.puzzleTitle, { ...device, exact: false });
    await NUMBERLINK_JOURNEY_BOARD.preview(device);
    await ui
      .get('content-draft-save-status')
      .expect.text('Saved on this device.', { ...device, exact: false });
  });
  await host.actAsGuest(
    'observeReconnectedNumberlinkCompletion',
    async (ui) => {
      const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
      if (
        (await contentAttribute(
          device,
          'content-attempt',
          'data-attemptid'
        )) !== kept.attemptId
      )
        throw new Error(
          'The offline attempt did not reach the second signed-in device'
        );
      await ui
        .get('content-attempt-complete')
        .expect.text('Puzzle completed', { ...device, exact: false });
      for (const row of [0, 1, 2])
        await observeNumberlinkJourneyRow(device, row, true);
    }
  );
}
