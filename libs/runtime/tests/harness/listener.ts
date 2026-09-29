/**
 * The app as someone listening to it hears it, and as someone using the
 * keyboard alone moves through it: each control's role and name, the ACT
 * rules' verdict on the page, the picture on the profile, and where the
 * keyboard is.
 */

import { type ProductHarness, scenarioAction } from '@libs/harness';
import {
  accessibleName,
  auditTree,
  controlsIn,
  describeControl,
  formatFailure,
  isHiddenFromAt,
  keyboardStops,
  roleOf,
} from '@pkgs/a11y';
import {
  actorPage,
  keyboardElement,
  keyboardPlace,
  keyboardToStart,
  placeOf,
} from './actor-page';
import { useKeyboard } from './people';

/** The person opens the app and listens to it instead of looking. */
export const listenToApp = scenarioAction({
  name: 'listenToApp',
  act: async (s, actorId: string) => {
    await actorPage(s, actorId);
  },
});

/** The person opens the app and uses it with the keyboard alone from now on. */
export const useKeyboardAlone = scenarioAction({
  name: 'useKeyboardAlone',
  act: async (s, actorId: string) => {
    const page = await actorPage(s, actorId);
    useKeyboard(s, actorId);
    keyboardToStart(page);
  },
});

export type Heard = {
  /** Every control on the page, as a listener hears it (`button "Profile"`). */
  readonly controls: readonly string[];
  /** Every ACT rule failure on the page. */
  readonly problems: readonly string[];
};

/** What a listener hears of the page the person is on. */
export async function pageHeard(
  s: ProductHarness,
  actorId: string
): Promise<Heard> {
  const page = await actorPage(s, actorId);
  return {
    controls: controlsIn(page).map(describeControl),
    problems: auditTree(page).map(formatFailure),
  };
}

export type PictureHeard = { readonly role: string; readonly name: string };

function heardAs(element: Element): PictureHeard {
  return { role: roleOf(element) ?? 'none', name: accessibleName(element) };
}

/**
 * What a listener hears for the picture on the person's profile: the
 * nearest picture around it or in it that is not hidden from them, or what
 * the picture itself is (`presentation`) when nothing is heard.
 */
export async function profilePictureHeard(
  s: ProductHarness,
  actorId: string
): Promise<PictureHeard | null> {
  const page = await actorPage(s, actorId);
  const avatar = page.querySelector(
    '[data-screen="profile"] [data-component="ScreenBody"] [data-component="Avatar"]'
  );
  if (avatar === null) return null;
  const around = avatar.closest('[role="img"]');
  if (around !== null && !isHiddenFromAt(around)) return heardAs(around);
  const pictures = [avatar, ...Array.from(avatar.querySelectorAll('*'))];
  const heard = pictures.find(
    (element) => roleOf(element) === 'img' && !isHiddenFromAt(element)
  );
  return heardAs(heard ?? avatar.querySelector('img') ?? avatar);
}

/** The screen the keyboard is on (`more` for Settings), or `null`. */
export async function keyboardScreen(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  const page = await actorPage(s, actorId);
  const element = keyboardElement(page);
  return element?.closest('[data-screen]')?.getAttribute('data-screen') ?? null;
}

/** Where the keyboard is (`spaces: button "Account menu"`), or `null`. */
export async function keyboardIsOn(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return keyboardPlace(await actorPage(s, actorId));
}

/** Every stop the keyboard should make on the page, in reading order. */
export async function keyboardStopsShown(
  s: ProductHarness,
  actorId: string
): Promise<readonly string[]> {
  return keyboardStops(await actorPage(s, actorId)).map(placeOf);
}
