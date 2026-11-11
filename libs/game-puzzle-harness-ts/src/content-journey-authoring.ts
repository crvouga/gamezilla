import type {
  ContentJourneyBoard,
  ContentJourneyDevice,
  PublishedJourneyContent,
} from './content-journey-device';
import {
  contentAttribute,
  contentExpectText,
  contentInput,
  contentTap,
  leaveContentStage,
  openContentDetails,
  openContentPlace,
  showContentHome,
} from './content-journey-device';

export async function createJourneyDraft(
  device: ContentJourneyDevice,
  kind: 'puzzle' | 'pack',
  title: string
): Promise<string> {
  await contentTap(device, `content-create-${kind}`);
  await contentTap(device, 'content-open-created-draft');
  const id = await contentAttribute(
    device,
    'content-author',
    'data-documentid'
  );
  await editJourneyMetadata(device, kind, title);
  return id;
}

/** Fills the builder's details screen, then returns to its hub. */
export async function editJourneyMetadata(
  device: ContentJourneyDevice,
  kind: 'puzzle' | 'pack',
  title: string
): Promise<void> {
  await openContentDetails(device);
  await contentInput(device, 'content-title', title);
  await contentInput(device, 'content-description', 'A gentle beginning');
  if (kind === 'puzzle')
    await contentInput(device, 'content-difficulty', 'Gentle');
  await device.ui
    .get('content-draft-save-status')
    .expect.text('Saved on this device.', { ...device, exact: false });
  await showContentHome(device);
}

/** Validates and publishes on the builder's publish screen, then opens the edition. */
export async function publishJourneyDraft(
  device: ContentJourneyDevice,
  title: string
): Promise<PublishedJourneyContent> {
  await contentTap(device, 'content-validate');
  await device.ui.get('content-validation-passed').expect.visible(device);
  await contentTap(device, 'content-publish');
  await device.ui
    .get('content-publish')
    .expect.text('Publication saved', { ...device, exact: false });
  // Saving queues the publication; the previous edition remains viewable until
  // this copy is confirmed and the document read names its new revision.
  await contentExpectText(
    device,
    'content-publication-status',
    'Published',
    true
  );
  await contentTap(device, 'content-view-publication');
  await device.ui
    .get('content-edition')
    .expect.text(title, { ...device, exact: false });
  return {
    documentId: await contentAttribute(
      device,
      'content-edition',
      'data-documentid'
    ),
    revisionId: await contentAttribute(
      device,
      'content-edition',
      'data-revisionid'
    ),
    title,
  };
}

/** All creation, editing, preview and playtesting use the shipped controls. */
export async function authorJourneyPuzzle(args: {
  device: ContentJourneyDevice;
  title: string;
  board: ContentJourneyBoard;
  onCreated: (documentId: string) => void;
}): Promise<PublishedJourneyContent> {
  const id = await createJourneyDraft(args.device, 'puzzle', args.title);
  args.onCreated(id);
  await openContentPlace(args.device, 'board');
  await args.board.edit(args.device);
  await openContentPlace(args.device, 'preview');
  await args.board.preview(args.device);
  await contentTap(args.device, 'content-start-playtest');
  await contentTap(args.device, 'content-open-playtest');
  await args.board.solve(args.device);
  await contentExpectText(
    args.device,
    'content-attempt-complete',
    'Playtest solved'
  );
  await leaveContentStage(args.device);
  await contentTap(args.device, `content-draft-${id}`);
  return publishJourneyDraft(args.device, args.title);
}
