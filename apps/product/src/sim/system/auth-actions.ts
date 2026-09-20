import { Handles } from '@libs/test-ids';
import {
  IDP_PASSWORD,
  IDP_TEST_IDS,
  idpSubOf,
} from '@pkgs/idp-google-sim/shared';
import type { Driver } from '@pkgs/ui-testing';

import { actorUi, pollUntil, scenarioAction } from './actor-ui';
import { actorEmail } from './identity';
import type { ProductSim } from './sim';

const WAIT_MS = 15_000;
/** Screens one sign-in can pass through (chooser → password → consent). */
const MAX_PROVIDER_STEPS = 6;

type ProviderScreen = 'identifier' | 'chooser' | 'password' | 'consent';

const SCREENS: readonly (readonly [ProviderScreen, string])[] = [
  ['identifier', IDP_TEST_IDS.identifierPage],
  ['chooser', IDP_TEST_IDS.chooserPage],
  ['password', IDP_TEST_IDS.passwordPage],
  ['consent', IDP_TEST_IDS.consentPage],
];

const SCREEN_TEST_IDS: Readonly<Record<ProviderScreen, string>> =
  Object.fromEntries(SCREENS) as Record<ProviderScreen, string>;

async function currentScreen(
  s: ProductSim,
  ui: Driver,
  done: () => Promise<boolean>
): Promise<ProviderScreen | 'done'> {
  return await pollUntil<ProviderScreen | 'done'>(
    s,
    async () => {
      if (await done()) return 'done';
      for (const [screen, testId] of SCREENS) {
        if (await ui.get(testId).isVisible()) return screen;
      }
      return null;
    },
    { maxMs: WAIT_MS, description: 'a Google sign-in screen' }
  );
}

/** One screen of the provider, answered the way the person would. */
async function answer(
  ui: Driver,
  screen: ProviderScreen,
  email: string
): Promise<void> {
  switch (screen) {
    case 'identifier':
      await ui.get(IDP_TEST_IDS.identifierEmail).clear();
      await ui.get(IDP_TEST_IDS.identifierEmail).input(email);
      await ui.get(IDP_TEST_IDS.identifierNext).tap({ timeoutMs: WAIT_MS });
      return;
    case 'chooser':
      await ui
        .get(IDP_TEST_IDS.chooserAccount(idpSubOf(email)))
        .tap({ timeoutMs: WAIT_MS });
      return;
    case 'password':
      await ui.get(IDP_TEST_IDS.passwordInput).input(IDP_PASSWORD);
      await ui.get(IDP_TEST_IDS.passwordNext).tap({ timeoutMs: WAIT_MS });
      return;
    case 'consent':
      await ui.get(IDP_TEST_IDS.consentAllow).tap({ timeoutMs: WAIT_MS });
      return;
  }
}

/**
 * Walk Google's sign-in window in the actor's browser until `done`: the
 * address step, the account chooser (a browser that
 * signed in before), the password step and the consent card — whichever the
 * provider serves.
 */
export async function completeGoogleSignIn(args: {
  readonly s: ProductSim;
  readonly ui: Driver;
  readonly actorId: string;
  /** Google address to sign in with; defaults to this actor's own. */
  readonly email?: string;
  /** The sign-in is over (the app shows it, or the window closed). */
  readonly done: () => Promise<boolean>;
}): Promise<void> {
  const { s, ui, actorId } = args;
  const email = args.email ?? actorEmail(s, actorId);
  for (let step = 0; step < MAX_PROVIDER_STEPS; step += 1) {
    const screen = await currentScreen(s, ui, args.done);
    if (screen === 'done') return;
    await answer(ui, screen, email);
    // The step is a round trip to the provider: the next screen (or the
    // redirect back to the app) replaces this one when it lands.
    await ui.get(SCREEN_TEST_IDS[screen]).expect.hidden({ timeoutMs: WAIT_MS });
  }
  throw new Error(`signInWithGoogle: ${actorId} never left the provider`);
}

/**
 * Open the avatar menu → Account, tap Continue with Google, walk the
 * provider's screens in the sign-in window, then dismiss the signed-in success.
 */
async function googleSignIn(
  s: ProductSim,
  actorId: string,
  email?: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.statusCurrentUser).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.globalMenuAccount).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.accountSignIn).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.authMethodGoogle).tap({ timeoutMs: WAIT_MS });
  await completeGoogleSignIn({
    s,
    ui,
    actorId,
    ...(email === undefined ? {} : { email }),
    done: () => ui.get(Handles.authSignedInDone).isVisible(),
  });
  await ui.get(Handles.authSignedInDone).tap({ timeoutMs: WAIT_MS });
  if (await ui.get(Handles.authModalClose).isVisible()) {
    await ui.get(Handles.authModalClose).tap({ timeoutMs: 1000 });
  }
}

export const signInWithGoogle = scenarioAction({
  name: 'signInWithGoogle',
  act: (s, actorId: string) => googleSignIn(s, actorId),
});

/**
 * The same person on a second device: `actorId` signs in with the Google
 * address that belongs to `accountActorId` (§34 "same account on two
 * devices").
 */
export const signInWithGoogleAsAccount = scenarioAction({
  name: 'signInWithGoogleAsAccount',
  act: (s, actorId: string, accountActorId: string) =>
    googleSignIn(s, actorId, actorEmail(s, accountActorId)),
});

/**
 * Confirm sign-out from the account screen.
 *
 * Clearing session capability swaps account chrome to the signed-out "Sign in"
 * row and tears down the MutationModal before its success face can paint, so
 * we assert signed-out chrome instead of `authSignedOut`.
 */
export const signOut = scenarioAction({
  name: 'signOut',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.accountSignOut).tap();
    await ui.get(Handles.authSignOutConfirm).tap();
    await ui.get(Handles.accountSignIn).expect.visible({ timeoutMs: WAIT_MS });
  },
});

/** Leave the Account stack so the tab shell is visible again. */
export const returnToTabs = scenarioAction({
  name: 'returnToTabs',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.navBack).tap();
    await ui.get(Handles.tabProfile).expect.visible();
  },
});
