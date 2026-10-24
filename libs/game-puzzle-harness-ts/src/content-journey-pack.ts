import {
  createJourneyDraft,
  publishJourneyDraft,
} from './content-journey-authoring';
import type {
  ContentJourneyDevice,
  PublishedJourneyContent,
} from './content-journey-device';
import { contentTap } from './content-journey-device';

export type PublishedJourneyPack = PublishedJourneyContent & {
  items: readonly PublishedJourneyContent[];
};

/** Add in one order, then change it before preview and publication. */
export async function authorJourneyPack(args: {
  device: ContentJourneyDevice;
  title: string;
  items: readonly [PublishedJourneyContent, PublishedJourneyContent];
  preview: () => Promise<void>;
  onCreated: (documentId: string) => void;
}): Promise<PublishedJourneyPack> {
  args.onCreated(await createJourneyDraft(args.device, 'pack', args.title));
  for (const item of args.items)
    await contentTap(args.device, `content-add-puzzle-${item.revisionId}`);
  const up = args.device.ui
    .get(`content-pack-item-${args.items[1].documentId}`)
    .get('content-pack-up');
  await up.wait('enabled', args.device);
  await up.tap(args.device);
  await args.device.ui
    .get('content-pack-order')
    .expect.text(args.items[1].title, { ...args.device, exact: false });
  await contentTap(args.device, 'content-preview');
  await contentTap(
    args.device,
    `content-preview-puzzle-${args.items[1].documentId}`
  );
  await args.preview();
  await contentTap(args.device, 'content-preview');
  const pack = await publishJourneyDraft(args.device, args.title);
  return { ...pack, items: [...args.items].reverse() };
}

export async function observeJourneyPack(
  device: ContentJourneyDevice,
  pack: PublishedJourneyPack,
  completed = 0
): Promise<void> {
  const list = device.ui.get('content-pack-puzzles');
  await list.expect.visible(device);
  for (const item of pack.items)
    await device.ui
      .get(`content-pack-puzzle-${item.revisionId}`)
      .expect.text(item.title, { ...device, exact: false });
  const text = (await list.text()) ?? '';
  let previous = -1;
  for (const item of pack.items) {
    const index = text.indexOf(item.title);
    if (index <= previous)
      throw new Error(
        `The published pack did not keep ${item.title} in its chosen order`
      );
    previous = index;
  }
  await device.ui
    .get('content-pack-progress')
    .expect.text(
      `${completed} of ${pack.items.length} puzzles completed`,
      device
    );
}
