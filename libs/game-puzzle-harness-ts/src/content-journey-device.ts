import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

export type ContentJourneyDevice = { ui: Driver; timeoutMs: number };
export type PublishedJourneyContent = {
  documentId: string;
  revisionId: string;
  title: string;
};
export type ContentJourneyBoard = {
  edit(device: ContentJourneyDevice): Promise<void>;
  preview(device: ContentJourneyDevice): Promise<void>;
  solve(device: ContentJourneyDevice): Promise<void>;
};

export async function contentTap(
  device: ContentJourneyDevice,
  id: string
): Promise<void> {
  await device.ui.get(id).wait('enabled', device);
  await device.ui.get(id).tap(device);
}

export async function contentAttribute(
  device: ContentJourneyDevice,
  id: string,
  attribute: string
): Promise<string> {
  await device.ui.get(id).expect.visible(device);
  const value = await device.ui.get(id).attribute(attribute);
  if (value === null || value === '')
    throw new Error(`${id} does not identify its ${attribute}`);
  return value;
}

export async function contentInput(
  device: ContentJourneyDevice,
  id: string,
  value: string
): Promise<void> {
  await device.ui.get(id).clear();
  await device.ui.get(id).input(value, device);
}

/**
 * The builder's details (title, description, difficulty), opened when the
 * builder shows them closed to one row over its stage.
 */
export async function openContentDetails(
  device: ContentJourneyDevice
): Promise<void> {
  const toggle = device.ui.get('content-author-details-toggle');
  await toggle.expect.visible(device);
  if ((await toggle.attribute('aria-expanded')) !== 'true')
    await contentTap(device, 'content-author-details-toggle');
  await device.ui.get('content-title').expect.visible(device);
}
