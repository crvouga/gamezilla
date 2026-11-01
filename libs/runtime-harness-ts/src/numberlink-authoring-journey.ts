import { authorJourneyPuzzle } from '@libs/game-puzzle-harness-ts/content-journey-authoring';
import {
  contentTap,
  type PublishedJourneyContent,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import { discoverJourneyContent } from '@libs/game-puzzle-harness-ts/content-journey-discovery';
import {
  authorJourneyPack,
  observeJourneyPack,
  type PublishedJourneyPack,
} from '@libs/game-puzzle-harness-ts/content-journey-pack';
import { withdrawJourneyPublications } from '@libs/game-puzzle-harness-ts/content-journey-withdraw';
import { NUMBERLINK_JOURNEY_BOARD } from '@libs/numberlink-harness-ts/numberlink-journey-board';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { endActiveSpace, hostSpace, JOURNEY_WAIT_MS } from './journey-gestures';
import { hostDeferringEnd } from './journey-space';
import type { JourneyAccess, JourneyHost } from './journey-types';
import { openNumberlinkLibrary } from './numberlink-journey-navigation';

async function authorChallenges(
  host: JourneyHost,
  onCreated: (documentId: string) => void
): Promise<readonly [PublishedJourneyContent, PublishedJourneyContent]> {
  const puzzles: PublishedJourneyContent[] = [];
  for (const name of ['River', 'Valley']) {
    await host.act(`authorNumberlink${name}`, async (ui) => {
      const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
      puzzles.push(
        await authorJourneyPuzzle({
          device,
          title: `${name} ${host.runId}`,
          board: NUMBERLINK_JOURNEY_BOARD,
          backId: Handles.navBack,
          onCreated,
        })
      );
      await contentTap(device, Handles.navBack);
    });
  }
  const first = puzzles[0];
  const second = puzzles[1];
  if (first === undefined || second === undefined)
    throw new Error('Both Numberlink challenges must be authored');
  return [first, second];
}

/** Both authored challenges and the reordered pack originate in the actual app. */
export async function authorNumberlinkJourney(
  host: JourneyHost,
  peerAccess: JourneyAccess = 'anonymous',
  owned: string[] = []
): Promise<PublishedJourneyPack> {
  await host.open('anonymous');
  const onCreated = (documentId: string): void => {
    owned.push(documentId);
  };
  host.defer('numberlink-publications', async (ui) => {
    if (owned.length === 0) return;
    await host.online();
    await withdrawJourneyPublications({
      device: { ui, timeoutMs: JOURNEY_WAIT_MS },
      documentIds: owned,
      backId: Handles.navBack,
    });
  });
  await hostDeferringEnd({ journey: host });
  await host.act('openNumberlink', openNumberlinkLibrary);
  const items = await authorChallenges(host, onCreated);
  let published: PublishedJourneyPack | undefined;
  await host.act('authorNumberlinkPack', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    published = await authorJourneyPack({
      device,
      title: `Rivers ${host.runId}`,
      items,
      onCreated,
      preview: () => NUMBERLINK_JOURNEY_BOARD.preview(device),
    });
  });
  if (published === undefined)
    throw new Error('The Numberlink pack was not published');
  await host.openPeer(peerAccess);
  let peerLink = '';
  host.defer('numberlink-guest-space', async () => {
    await host.peerDevice.online();
    if (peerLink !== '') await host.openGuest(peerLink);
    await host.actAsGuest('endNumberlinkGuestSpace', endActiveSpace);
  });
  await host.actAsGuest('hostNumberlinkGuestSpace', hostSpace);
  peerLink = await host.peerDevice.spaceLink();
  await host.actAsGuest('discoverNumberlinkPack', async (ui) => {
    await openNumberlinkLibrary(ui);
    await discoverJourneyContent(
      { ui, timeoutMs: JOURNEY_WAIT_MS },
      published!.revisionId
    );
  });
  return published;
}

export async function observeNumberlinkJourneyPack(
  host: JourneyHost,
  pack: PublishedJourneyPack
): Promise<void> {
  await host.actAsGuest('observePublishedNumberlinkPack', (ui) =>
    observeJourneyPack({ ui, timeoutMs: JOURNEY_WAIT_MS }, pack)
  );
}
