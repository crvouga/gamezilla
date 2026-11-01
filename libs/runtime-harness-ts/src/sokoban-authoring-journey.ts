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
import { SOKOBAN_JOURNEY_BOARD } from '@libs/sokoban-harness-ts/sokoban-journey-board';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { openContentLibrary } from './content-library-navigation';
import { endActiveSpace, hostSpace, JOURNEY_WAIT_MS } from './journey-gestures';
import { hostDeferringEnd } from './journey-space';
import type { JourneyAccess, JourneyHost } from './journey-types';

export const openSokobanLibrary = (
  ui: Parameters<typeof openContentLibrary>[0]
) => openContentLibrary(ui, 'sokoban');

/** Builds, playtests and publishes one Sokoban puzzle through the app's builder. */
async function authorSokobanPuzzle(
  host: JourneyHost,
  name: string,
  owned: string[]
): Promise<PublishedJourneyContent> {
  let puzzle: PublishedJourneyContent | undefined;
  await host.act(`authorSokoban${name}`, async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    puzzle = await authorJourneyPuzzle({
      device,
      title: `${name} ${host.runId}`,
      board: SOKOBAN_JOURNEY_BOARD,
      backId: Handles.navBack,
      onCreated: (id) => {
        owned.push(id);
      },
    });
    await contentTap(device, Handles.navBack);
  });
  if (puzzle === undefined) throw new Error(`${name} was not published`);
  return puzzle;
}

export type SokobanAuthoring = {
  readonly first: PublishedJourneyContent;
  readonly owned: string[];
};

/** A fresh device opens the app and builds its first Sokoban puzzle. */
export async function beginSokobanAuthoring(
  host: JourneyHost
): Promise<SokobanAuthoring> {
  const owned: string[] = [];
  await host.open('anonymous');
  host.defer('sokoban-publications', async (ui) => {
    if (owned.length === 0) return;
    await host.online();
    await withdrawJourneyPublications({
      device: { ui, timeoutMs: JOURNEY_WAIT_MS },
      documentIds: owned,
      backId: Handles.navBack,
    });
  });
  await hostDeferringEnd({ journey: host });
  await host.act('openSokoban', openSokobanLibrary);
  return { first: await authorSokobanPuzzle(host, 'Lift', owned), owned };
}

/** Another puzzle, then a pack listing it before the first one, opened by the other person. */
export async function publishSokobanPack(
  host: JourneyHost,
  authoring: SokobanAuthoring,
  peerAccess: JourneyAccess = 'anonymous'
): Promise<PublishedJourneyPack> {
  const other = await authorSokobanPuzzle(host, 'Ramp', authoring.owned);
  let published: PublishedJourneyPack | undefined;
  await host.act('authorSokobanPack', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    published = await authorJourneyPack({
      device,
      title: `Warehouse ${host.runId}`,
      items: [authoring.first, other],
      onCreated: (id) => {
        authoring.owned.push(id);
      },
      preview: () => SOKOBAN_JOURNEY_BOARD.preview(device),
    });
  });
  if (published === undefined)
    throw new Error('The Sokoban pack was not published');
  await host.openPeer(peerAccess);
  let peerLink = '';
  host.defer('sokoban-guest-space', async () => {
    await host.peerDevice.online();
    if (peerLink !== '') await host.openGuest(peerLink);
    await host.actAsGuest('endSokobanGuestSpace', endActiveSpace);
  });
  await host.actAsGuest('hostSokobanGuestSpace', hostSpace);
  peerLink = await host.peerDevice.spaceLink();
  const pack = published;
  await host.actAsGuest('discoverSokobanPack', async (ui) => {
    await openSokobanLibrary(ui);
    await discoverJourneyContent(
      { ui, timeoutMs: JOURNEY_WAIT_MS },
      pack.revisionId
    );
  });
  return pack;
}

export async function observeSokobanPack(
  host: JourneyHost,
  pack: PublishedJourneyPack
): Promise<void> {
  await host.actAsGuest('observePublishedSokobanPack', (ui) =>
    observeJourneyPack({ ui, timeoutMs: JOURNEY_WAIT_MS }, pack)
  );
}
