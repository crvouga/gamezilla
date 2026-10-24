import { publishJourneyDraft } from '@libs/game-puzzle-harness-ts/content-journey-authoring';
import {
  contentAttribute,
  contentInput,
  contentTap,
  type PublishedJourneyContent,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import {
  observeJourneyPack,
  type PublishedJourneyPack,
} from '@libs/game-puzzle-harness-ts/content-journey-pack';
import { startJourneyAttempt } from '@libs/game-puzzle-harness-ts/content-journey-playing';
import {
  drawNumberlinkJourneyRow,
  NUMBERLINK_JOURNEY_BOARD,
  observeNumberlinkJourneyRow,
} from '@libs/numberlink-harness-ts/numberlink-journey-board';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { JOURNEY_WAIT_MS } from './journey-gestures';
import type { JourneyHost } from './journey-types';
import { authorNumberlinkJourney } from './numberlink-authoring-journey';

export type NumberlinkRevisionJourney = {
  pack: PublishedJourneyPack;
  source: PublishedJourneyContent;
  attemptId: string;
};

/** A new public drawing never replaces the body an earlier attempt or pack chose. */
export async function reviseNumberlinkJourney(
  host: JourneyHost
): Promise<NumberlinkRevisionJourney> {
  const pack = await authorNumberlinkJourney(host);
  const source = pack.items[0];
  if (source === undefined)
    throw new Error('The published pack must have a first challenge');
  let attemptId = '';
  await host.actAsGuest('startEarlierNumberlinkEdition', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    await contentTap(device, 'content-pack-next');
    attemptId = await startJourneyAttempt(device);
    await drawNumberlinkJourneyRow(device, 0);
  });
  await host.act('publishChangedNumberlinkEdition', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    await contentTap(device, Handles.navBack);
    await contentTap(device, `content-draft-${source.documentId}`);
    await contentInput(device, 'content-title', `Canyon ${host.runId}`);
    await contentInput(device, 'numberlink-pair-label', 'B');
    const latest = await publishJourneyDraft(device, `Canyon ${host.runId}`);
    if (
      latest.documentId !== source.documentId ||
      latest.revisionId === source.revisionId
    )
      throw new Error(
        'The changed Numberlink did not become a new edition of the same challenge'
      );
    const label = await ui
      .get('numberlink-board-cell-0')
      .attribute('aria-label');
    if (!label?.includes('endpoint B'))
      throw new Error(
        'The new publication did not include the changed drawing'
      );
  });
  await host.actAsGuest('returnThroughEarlierNumberlinkPack', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    await contentTap(device, 'content-return-pack');
    await observeJourneyPack(device, pack);
    await contentTap(device, 'content-pack-next');
    await contentTap(device, 'content-continue-attempt');
  });
  return { pack, source, attemptId };
}

export async function observeEarlierNumberlink(
  host: JourneyHost,
  kept: NumberlinkRevisionJourney
): Promise<void> {
  await host.actAsGuest('observeOriginalNumberlinkEdition', async (ui) => {
    const device = { ui, timeoutMs: JOURNEY_WAIT_MS };
    const root = 'content-attempt';
    for (const [attribute, expected] of [
      ['data-attemptid', kept.attemptId],
      ['data-sourceid', kept.source.revisionId],
      ['data-packrevisionid', kept.pack.revisionId],
    ] as const)
      if ((await contentAttribute(device, root, attribute)) !== expected)
        throw new Error(`The earlier Numberlink lost its ${attribute}`);
    await ui
      .get(root)
      .expect.text(kept.source.title, { ...device, exact: false });
    await NUMBERLINK_JOURNEY_BOARD.preview(device);
    await observeNumberlinkJourneyRow(device, 0, true);
  });
}
