import type { ContentJourneyDevice } from './content-journey-device';
import { contentTap, openContentPlace } from './content-journey-device';

/** Back, a screen at a time, until the library's hub and its create rows show. */
async function returnToLibrary(
  device: ContentJourneyDevice,
  backId: string
): Promise<void> {
  for (let depth = 0; depth < 8; depth++) {
    if (await device.ui.get('content-create-puzzle').isVisible()) return;
    await contentTap(device, backId);
  }
  throw new Error(
    'The owned content library did not open for publication cleanup'
  );
}

/** Live journeys withdraw only the documents they created, through their ordinary owner controls. */
export async function withdrawJourneyPublications(args: {
  device: ContentJourneyDevice;
  documentIds: readonly string[];
  backId: string;
}): Promise<void> {
  for (const id of [...args.documentIds].reverse()) {
    await returnToLibrary(args.device, args.backId);
    await contentTap(args.device, `content-draft-${id}`);
    // Withdrawing is offered on the builder's publish screen, once published.
    await openContentPlace(args.device, 'publish');
    if (!(await args.device.ui.get('content-withdraw').isVisible())) continue;
    await contentTap(args.device, 'content-withdraw');
    await contentTap(args.device, 'content-withdraw-confirm');
    await contentTap(args.device, 'content-withdraw-dismiss');
  }
}
