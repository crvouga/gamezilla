import { createJourneyDraft } from '@libs/game-puzzle-harness-ts/content-journey-authoring';
import {
  contentAttribute,
  contentTap,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import { discoverJourneyContent } from '@libs/game-puzzle-harness-ts/content-journey-discovery';
import { startJourneyAttempt } from '@libs/game-puzzle-harness-ts/content-journey-playing';
import { withdrawJourneyPublications } from '@libs/game-puzzle-harness-ts/content-journey-withdraw';
import { SOKOBAN_JOURNEY_BOARD } from '@libs/sokoban-harness-ts/sokoban-journey-board';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  endActiveSpace,
  hostSpace,
  JOURNEY_WAIT_MS,
  tap,
} from './journey-gestures';
import { hostDeferringEnd } from './journey-space';
import type { JourneyHost } from './journey-types';
import { openSokobanLibrary } from './sokoban-authoring-journey';

/** The pack Sokoban ships: its library entry is named by its document. */
const STARTER_PACK = 'content-bundled-bundled:sokoban:sokoban-starter';

export type SokobanOfflineJourney = {
  readonly documentId: string;
  readonly title: string;
  revisionId: string;
};

const device = (ui: Driver) => ({ ui, timeoutMs: JOURNEY_WAIT_MS });

/** Both people are in the app, then lose the connection; Alice builds and playtests, Bob plays. */
export async function keepSokobanWorkOffline(
  host: JourneyHost
): Promise<SokobanOfflineJourney> {
  const owned: string[] = [];
  await host.open('anonymous');
  host.defer('sokoban-offline-publications', async (ui) => {
    if (owned.length === 0) return;
    await host.online();
    await withdrawJourneyPublications({
      device: device(ui),
      documentIds: owned,
      backId: Handles.navBack,
    });
  });
  await hostDeferringEnd({ journey: host });
  await host.act('openSokobanBeforeDisconnecting', openSokobanLibrary);
  await host.openPeer('anonymous');
  host.defer('sokoban-offline-guest-space', async () => {
    await host.peerDevice.online();
    await host.actAsGuest('endSokobanOfflineGuestSpace', endActiveSpace);
  });
  await host.actAsGuest('hostSokobanOfflineGuestSpace', hostSpace);
  await host.actAsGuest(
    'openSokobanStarterBeforeDisconnecting',
    openSokobanLibrary
  );
  await host.offline();
  await host.peerDevice.offline();
  const title = `Cellar ${host.runId}`;
  let documentId = '';
  await host.act('buildAndPlaytestSokobanWithoutConnection', async (ui) => {
    await ui.get('content-offline').expect.visible(device(ui));
    documentId = await createJourneyDraft(device(ui), 'puzzle', title);
    owned.push(documentId);
    await SOKOBAN_JOURNEY_BOARD.edit(device(ui));
    await contentTap(device(ui), 'content-start-playtest');
    await contentTap(device(ui), 'content-open-playtest');
    await SOKOBAN_JOURNEY_BOARD.solve(device(ui));
    await ui
      .get('content-attempt-complete')
      .expect.text('Playtest solved', { ...device(ui), exact: false });
    await contentTap(device(ui), Handles.navBack);
    await contentTap(device(ui), `content-draft-${documentId}`);
  });
  await host.actAsGuest('playSokobanStarterWithoutConnection', async (ui) => {
    await ui.get('content-offline').expect.visible(device(ui));
    await tap(ui, STARTER_PACK);
    await contentTap(device(ui), 'content-pack-next');
    await startJourneyAttempt(device(ui));
    // The first starter puzzle: a step right, then a push onto the goal.
    await SOKOBAN_JOURNEY_BOARD.solve(device(ui));
    await ui
      .get('content-attempt-complete')
      .expect.text('Puzzle completed', { ...device(ui), exact: false });
  });
  return { documentId, title, revisionId: '' };
}

export async function publishSokobanWhileOffline(
  host: JourneyHost
): Promise<void> {
  await host.act('publishSokobanWithoutConnection', (ui) =>
    contentTap(device(ui), 'content-publish')
  );
}

export async function observePublicationWaiting(
  host: JourneyHost
): Promise<void> {
  await host.act('observeSokobanPublicationWaiting', (ui) =>
    ui
      .get('content-publication-pending')
      .expect.text('Publication waits for your connection', {
        ...device(ui),
        exact: false,
      })
  );
}

export async function reconnectSokobanPeople(host: JourneyHost): Promise<void> {
  await host.online();
  await host.peerDevice.online();
}

/** Alice's publication went ahead, Bob discovers it, and his starter completion stayed. */
export async function observeReconnectedSokoban(
  host: JourneyHost,
  kept: SokobanOfflineJourney
): Promise<void> {
  await host.act('observeSokobanPublishedAfterReconnecting', async (ui) => {
    await contentTap(device(ui), 'content-view-publication');
    kept.revisionId = await contentAttribute(
      device(ui),
      'content-edition',
      'data-revisionid'
    );
    await contentTap(device(ui), Handles.navBack);
  });
  await host.actAsGuest('discoverSokobanAfterReconnecting', async (ui) => {
    await contentTap(device(ui), 'content-return-pack');
    await ui
      .get('content-pack-progress')
      .expect.text('1 of 4 puzzles completed', device(ui));
    await contentTap(device(ui), Handles.navBack);
    await discoverJourneyContent(
      { ui, timeoutMs: JOURNEY_WAIT_MS },
      kept.revisionId
    );
    await ui
      .get('content-edition')
      .expect.text(kept.title, { ...device(ui), exact: false });
  });
}
