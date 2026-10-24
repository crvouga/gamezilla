import type { ContentJourneyDevice } from './content-journey-device';
import { contentAttribute, contentTap } from './content-journey-device';

export async function startJourneyAttempt(
  device: ContentJourneyDevice
): Promise<string> {
  await contentTap(device, 'content-start-attempt');
  await contentTap(device, 'content-continue-attempt');
  return contentAttribute(device, 'content-attempt', 'data-attemptid');
}

export async function openJourneyAttempt(
  device: ContentJourneyDevice,
  id: string
): Promise<void> {
  await contentTap(device, `content-attempt-${id}`);
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
