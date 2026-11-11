import {
  type ContentJourneyDevice,
  contentTap,
  openContentPlace,
} from './content-journey-device';

/** Discover the edition through the library's Browse screen and its pagination. */
export async function discoverJourneyContent(
  device: ContentJourneyDevice,
  revisionId: string
): Promise<void> {
  const target = device.ui.get(`content-published-${revisionId}`);
  const moreId = 'content-more-published';
  await openContentPlace(device, 'browse');
  for (;;) {
    await target.wait('visible', { ...device, visibleOr: [moreId] });
    if (await target.isVisible()) break;
    await contentTap(device, moreId);
  }
  await target.tap(device);
}
