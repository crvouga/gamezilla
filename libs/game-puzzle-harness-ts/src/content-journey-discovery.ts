import {
  type ContentJourneyDevice,
  contentTap,
  showLibraryTabOf,
} from './content-journey-device';

/** Discover the edition through the library's ordinary pagination controls. */
export async function discoverJourneyContent(
  device: ContentJourneyDevice,
  revisionId: string
): Promise<void> {
  const target = device.ui.get(`content-published-${revisionId}`);
  const moreId = 'content-more-published';
  await showLibraryTabOf(device, `content-published-${revisionId}`);
  for (;;) {
    await target.wait('visible', { ...device, visibleOr: [moreId] });
    if (await target.isVisible()) break;
    await contentTap(device, moreId);
  }
  await target.tap(device);
}
