import {
  contentOnDevice,
  playOnDevice,
} from '@libs/game-puzzle-harness-ts/content-game-reads';
import { waitForContent } from '@libs/game-puzzle-harness-ts/content-sync';
import { mountContentExample } from '@libs/game-puzzle-harness-ts/mount-content-example';
import { fireEvent } from '@solidjs/testing-library';
import type { SokobanHarness } from './sokoban-system';

export type View = Awaited<ReturnType<typeof mountContentExample>>;

/** What one device has open besides the builder, and what it was last told. */
type DeviceScreens = {
  play: { readonly view: View; attemptId: string } | null;
  told: string | null;
};
const SCREENS = new WeakMap<SokobanHarness, Map<string, DeviceScreens>>();

export function screensOf(s: SokobanHarness, clientId: string): DeviceScreens {
  let devices = SCREENS.get(s);
  if (devices === undefined) {
    devices = new Map();
    SCREENS.set(s, devices);
  }
  let screens = devices.get(clientId);
  if (screens === undefined) {
    screens = { play: null, told: null };
    devices.set(clientId, screens);
  }
  return screens;
}

export function closePlay(s: SokobanHarness, clientId: string): void {
  const screens = screensOf(s, clientId);
  screens.play?.view.unmount();
  screens.play = null;
}

export async function waitFor(
  s: SokobanHarness,
  predicate: () => boolean | Promise<boolean>
): Promise<void> {
  await waitForContent(s, async () => await predicate());
}

export async function clickWhenReady(
  s: SokobanHarness,
  view: View,
  testId: string
): Promise<void> {
  await waitFor(s, () => {
    const element = view.queryByTestId(testId);
    return element !== null && !element.hasAttribute('disabled');
  });
  fireEvent.click(view.getByTestId(testId));
}

export const deviceLibrary = contentOnDevice;
export const devicePlay = playOnDevice;

/** Opens a saved attempt from the library, as a person returning to it does. */
export async function openAttemptOnScreen(
  s: SokobanHarness,
  clientId: string,
  attemptId: string
): Promise<View> {
  closePlay(s, clientId);
  const view = await mountContentExample(s, clientId);
  await clickWhenReady(s, view, `content-attempt-${attemptId}`);
  await waitFor(s, () => view.queryByTestId('content-attempt') !== null);
  screensOf(s, clientId).play = { view, attemptId };
  return view;
}

export function playView(s: SokobanHarness, clientId: string): View {
  const play = screensOf(s, clientId).play;
  if (play === null) throw new Error(`${clientId} is not playing`);
  return play.view;
}

/** The position save settles: nothing pending on the open attempt. */
export async function settlePlay(
  s: SokobanHarness,
  clientId: string
): Promise<void> {
  const view = playView(s, clientId);
  await waitFor(
    s,
    () =>
      view.queryByTestId('content-position-save-status')?.textContent ===
      'Progress saved on this device. Changes share when connected.'
  );
}
