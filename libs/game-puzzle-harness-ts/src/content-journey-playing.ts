import type { ContentJourneyDevice } from './content-journey-device';
import { contentAttribute, contentTap } from './content-journey-device';

export async function startJourneyAttempt(
  device: ContentJourneyDevice
): Promise<string> {
  await contentTap(device, 'content-start-attempt');
  await contentTap(device, 'content-continue-attempt');
  return contentAttribute(device, 'content-attempt', 'data-attemptid');
}

/**
 * Reopens a saved attempt from the library: one to continue under
 * Continue, a `solved` one under Browse, where the library lists it.
 */
export async function openJourneyAttempt(
  device: ContentJourneyDevice,
  id: string,
  list: 'unfinished' | 'solved' = 'unfinished'
): Promise<void> {
  await contentTap(
    device,
    `content-attempt-${id}`,
    list === 'solved' ? 'content-library-tab-browse' : undefined
  );
  if (
    (await contentAttribute(device, 'content-attempt', 'data-attemptid')) !== id
  )
    throw new Error('The saved attempt did not reopen at its own identity');
}

export async function waitForJourneyPosition(
  device: ContentJourneyDevice
): Promise<void> {
  await device.ui
    .get('content-position-save-status')
    .expect.text('Progress saved on this device.', { ...device, exact: false });
}

export async function restartJourneyAttempt(
  device: ContentJourneyDevice
): Promise<string> {
  await contentTap(device, 'content-restart');
  await contentTap(device, 'content-restart-confirm');
  await contentTap(device, 'content-restart-dismiss');
  await contentTap(device, 'content-open-restart');
  return contentAttribute(device, 'content-attempt', 'data-attemptid');
}
