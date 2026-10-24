import { publishJourneyDraft } from '@libs/game-puzzle-harness-ts/content-journey-authoring';
import {
  contentAttribute,
  contentTap,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import type { PublishedJourneyPack } from '@libs/game-puzzle-harness-ts/content-journey-pack';
import {
  type JourneyPackDraft,
  observeJourneyPackDraft,
} from '@libs/game-puzzle-harness-ts/content-journey-pack-draft';
import { NUMBERLINK_JOURNEY_BOARD } from '@libs/numberlink-harness-ts/numberlink-journey-board';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { JOURNEY_WAIT_MS } from './journey-gestures';
import type { JourneyHost } from './journey-types';
import { openNumberlinkSpace } from './numberlink-journey-navigation';

export async function reopenOfflineNumberlinkDraft(
  host: JourneyHost,
  link: string,
  draft: JourneyPackDraft
): Promise<void> {
  await host.reopen();
  await openNumberlinkSpace(host, link);
  await host.act('reopenOfflineNumberlinkAuthoring', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    await ui.get('content-offline').expect.visible(device);
    await contentTap(device, `content-draft-${draft.documentId}`);
    await observeJourneyPackDraft(device, draft);
    await contentTap(device, Handles.navBack);
    await contentTap(device, `content-draft-${draft.puzzleId}`);
    await ui
      .get('content-author')
      .expect.text(draft.puzzleTitle, { ...device, exact: false });
    await NUMBERLINK_JOURNEY_BOARD.preview(device);
    await ui
      .get('content-draft-save-status')
      .expect.text('Saved on this device.', { ...device, exact: false });
  });
}

/** Publishing after reconnection proves the offline authoring reached another person's device. */
export async function publishOfflineNumberlinkDraft(
  host: JourneyHost,
  draft: JourneyPackDraft
): Promise<PublishedJourneyPack> {
  let pack: PublishedJourneyPack | undefined;
  await host.act('publishReconnectedNumberlinkWork', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    const puzzle = await publishJourneyDraft(device, draft.puzzleTitle);
    if (puzzle.documentId !== draft.puzzleId)
      throw new Error('Publishing replaced the identity of the offline puzzle');
    await contentTap(device, Handles.navBack);
    await contentTap(device, `content-draft-${draft.documentId}`);
    await observeJourneyPackDraft(device, draft);
    const published = await publishJourneyDraft(device, draft.title);
    pack = { ...published, items: [puzzle, draft.existing] };
    await contentTap(device, Handles.navBack);
    await contentTap(device, `content-draft-${draft.puzzleId}`);
    if (
      (await contentAttribute(device, 'content-author', 'data-documentid')) !==
      draft.puzzleId
    )
      throw new Error('The offline puzzle draft did not remain editable');
  });
  if (pack === undefined) throw new Error('The offline pack was not published');
  return pack;
}
