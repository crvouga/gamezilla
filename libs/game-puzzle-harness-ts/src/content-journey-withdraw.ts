import type { ContentJourneyDevice } from './content-journey-device';
import { contentTap } from './content-journey-device';

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
    if (!(await args.device.ui.get('content-withdraw').isVisible())) continue;
    await contentTap(args.device, 'content-withdraw');
    await contentTap(args.device, 'content-withdraw-confirm');
    await contentTap(args.device, 'content-withdraw-dismiss');
  }
}
