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

/**
 * The library tab that lists a row, by the row's id: published and
 * starter content under Browse, attempts to continue under Continue, the
 * person's drafts and publications under My creations. A solved attempt
 * is listed under Browse instead: its caller says so (`openJourneyAttempt`).
 */
function libraryTabOf(id: string): string | null {
  if (/^content-(published|bundled)-|^content-more-published$/.test(id))
    return 'content-library-tab-browse';
  if (id.startsWith('content-attempt-')) return 'content-library-tab-continue';
  if (id.startsWith('content-draft-')) return 'content-library-tab-mine';
  return null;
}

/**
 * On the library, shows the tab that lists `id` (by default the one its id
 * says) before it is pressed: the library shows one tab at a time.
 * Elsewhere (an attempt's own screen has ids of the same shape) there are
 * no library tabs and nothing changes.
 */
export async function showLibraryTabOf(
  device: ContentJourneyDevice,
  id: string,
  tab: string | null = libraryTabOf(id)
): Promise<void> {
  if (tab === null) return;
  await device.ui
    .get(id)
    .wait('visible', { ...device, visibleOr: [tab] })
    .catch(() => undefined);
  if (await device.ui.get(id).isVisible()) return;
  if (!(await device.ui.get(tab).isVisible())) return;
  if ((await device.ui.get(tab).attribute('aria-selected')) !== 'true')
    await device.ui.get(tab).tap(device);
}

/** Taps `id`, first showing its library tab (`tab`, else the one its id says). */
export async function contentTap(
  device: ContentJourneyDevice,
  id: string,
  tab?: string
): Promise<void> {
  await showLibraryTabOf(device, id, tab);
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
