import {
  type ContentJourneyDevice,
  contentTap,
} from './content-journey-device';

/** Discover the edition through the library's ordinary pagination controls. */
export async function discoverJourneyContent(
  device: ContentJourneyDevice,
  revisionId: string
): Promise<void> {
  const target = device.ui.get(`content-published-${revisionId}`);
  const moreId = 'content-more-published';
  for (;;) {
    await target.wait('visible', { ...device, visibleOr: [moreId] });
    if (await target.isVisible()) break;
    await contentTap(device, moreId);
  }
  await target.tap(device);
}
