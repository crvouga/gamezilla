import type { ContentJourneyDevice } from './content-journey-device';
import {
  contentAttribute,
  contentExpectText,
  contentTap,
  showContentHome,
} from './content-journey-device';

export async function startJourneyAttempt(
  device: ContentJourneyDevice
): Promise<string> {
  await contentTap(device, 'content-start-attempt');
  await contentTap(device, 'content-continue-attempt');
  return contentAttribute(device, 'content-attempt', 'data-attemptid');
}

/**
 * Reopens a saved attempt from the library: one to continue from its
 * Continue screen, a `solved` one from its Solved screen.
 */
export async function openJourneyAttempt(
  device: ContentJourneyDevice,
  id: string,
  list: 'unfinished' | 'solved' = 'unfinished'
): Promise<void> {
  await contentTap(
    device,
    `content-attempt-${id}`,
    list === 'solved' ? 'solved' : 'continue'
  );
  if (
    (await contentAttribute(device, 'content-attempt', 'data-attemptid')) !== id
  )
    throw new Error('The saved attempt did not reopen at its own identity');
}

/** The board's own status line says the last move is kept. */
export async function waitForJourneyPosition(
  device: ContentJourneyDevice
): Promise<void> {
  await device.ui
    .get('content-position-save-status')
    .expect.text('Progress saved on this device.', { ...device, exact: false });
}

/**
 * Reads the attempt's completion record on its progress screen, then
 * returns to the board.
 */
export async function expectJourneyCompletion(
  device: ContentJourneyDevice,
  text: string
): Promise<void> {
  await contentExpectText(device, 'content-attempt-complete', text);
  await showContentHome(device);
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
