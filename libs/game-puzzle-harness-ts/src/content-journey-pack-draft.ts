import {
  createJourneyDraft,
  editJourneyMetadata,
} from './content-journey-authoring';
import type {
  ContentJourneyBoard,
  ContentJourneyDevice,
  PublishedJourneyContent,
} from './content-journey-device';
import { contentAttribute, contentTap } from './content-journey-device';

export type JourneyPackDraft = {
  documentId: string;
  title: string;
  puzzleId: string;
  puzzleTitle: string;
  existing: PublishedJourneyContent;
};

/** Creating a challenge within the ordinary pack builder, without publishing it. */
export async function createJourneyPackWithPuzzle(args: {
  device: ContentJourneyDevice;
  title: string;
  puzzleTitle: string;
  existing: PublishedJourneyContent;
  board: ContentJourneyBoard;
  backId: string;
  onCreated: (id: string) => void;
}): Promise<JourneyPackDraft> {
  const device = args.device;
  const documentId = await createJourneyDraft(device, 'pack', args.title);
  args.onCreated(documentId);
  await contentTap(device, `content-add-puzzle-${args.existing.revisionId}`);
  await contentTap(device, 'content-create-in-pack');
  await contentTap(device, 'content-open-pack-puzzle');
  const puzzleId = await contentAttribute(
    device,
    'content-author',
    'data-documentid'
  );
  args.onCreated(puzzleId);
  await editJourneyMetadata(device, 'puzzle', args.puzzleTitle);
  await args.board.edit(device);
  await device.ui
    .get('content-draft-save-status')
    .expect.text('Saved on this device.', { ...device, exact: false });
  await contentTap(device, args.backId);
  await contentTap(device, `content-draft-${documentId}`);
  const up = device.ui
    .get(`content-pack-item-${puzzleId}`)
    .get('content-pack-up');
  await up.wait('enabled', device);
  await up.tap(device);
  await contentTap(device, 'content-preview');
  await contentTap(device, `content-preview-puzzle-${puzzleId}`);
  await args.board.preview(device);
  await contentTap(device, 'content-preview');
  return {
    documentId,
    title: args.title,
    puzzleId,
    puzzleTitle: args.puzzleTitle,
    existing: args.existing,
  };
}

export async function observeJourneyPackDraft(
  device: ContentJourneyDevice,
  draft: JourneyPackDraft
): Promise<void> {
  if (
    (await contentAttribute(device, 'content-author', 'data-documentid')) !==
    draft.documentId
  )
    throw new Error('The working pack did not reopen at its own identity');
  for (const [id, title] of [
    [draft.puzzleId, draft.puzzleTitle],
    [draft.existing.documentId, draft.existing.title],
  ] as const)
    await device.ui
      .get(`content-pack-item-${id}`)
      .expect.text(title, { ...device, exact: false });
  const order = (await device.ui.get('content-pack-order').text()) ?? '';
  if (order.indexOf(draft.puzzleTitle) >= order.indexOf(draft.existing.title))
    throw new Error('The working pack lost the order chosen before reopening');
}
