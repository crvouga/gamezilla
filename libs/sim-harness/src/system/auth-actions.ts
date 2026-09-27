import { Handles } from '@libs/test-ids';
import type { OauthProviderId } from '@pkgs/auth/shared';
import type { Driver } from '@pkgs/ui-testing';

import { actorUi, pollUntil, scenarioAction } from './actor-ui';
import { type AppleAccountKind, actorAppleEmail, actorEmail } from './identity';
import { completeProviderSignIn, type ProviderAnswers } from './provider-walk';
import type { ProductSim } from './sim';

const WAIT_MS = 15_000;

/** The sign-in modal settled: signed in, failed, or asking to link. */
async function modalSettled(ui: Driver): Promise<boolean> {
  for (const testId of [
    Handles.authSignedInDone,
    Handles.authLinkRequired,
    Handles.authSignInFailed,
  ]) {
    if (await ui.get(testId).isVisible()) return true;
  }
  return false;
}

async function openSignInModal(ui: Driver): Promise<void> {
  if (!(await ui.get(Handles.accountSignIn).isVisible())) {
    await ui.get(Handles.statusCurrentUser).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.globalMenuAccount).tap({ timeoutMs: WAIT_MS });
  }
  await ui.get(Handles.accountSignIn).tap({ timeoutMs: WAIT_MS });
}

/** Dismiss the "Signed in" success face and the modal. */
export async function dismissSignedIn(ui: Driver): Promise<void> {
  await ui.get(Handles.authSignedInDone).tap({ timeoutMs: WAIT_MS });
  if (await ui.get(Handles.authModalClose).isVisible()) {
    await ui.get(Handles.authModalClose).tap({ timeoutMs: 1000 });
  }
}

/**
 * Open the avatar menu → Account, tap a sign-in method, walk the provider's
 * screens in the sign-in window, and stop where the modal lands: signed in,
 * or "Connect your accounts?".
 */
async function providerSignIn(
  s: ProductSim,
  actorId: string,
  answers: ProviderAnswers
): Promise<void> {
  const ui = await actorUi(s, actorId);
  await openSignInModal(ui);
  const method =
    answers.provider === 'apple'
      ? Handles.authMethodApple
      : Handles.authMethodGoogle;
  await ui.get(method).tap({ timeoutMs: WAIT_MS });
  await completeProviderSignIn({
    s,
    ui,
    actorId,
    answers,
    done: () => modalSettled(ui),
  });
  if (await ui.get(Handles.authSignedInDone).isVisible()) {
    await dismissSignedIn(ui);
  }
}

export const signInWithGoogle = scenarioAction({
  name: 'signInWithGoogle',
  act: (s, actorId: string) =>
    providerSignIn(s, actorId, {
      provider: 'google',
      email: actorEmail(s, actorId),
    }),
});

/**
 * The same person on a second device: `actorId` signs in with the Google
 * address that belongs to `accountActorId` (§34 "same account on two
 * devices").
 */
export const signInWithGoogleAsAccount = scenarioAction({
  name: 'signInWithGoogleAsAccount',
  act: (s, actorId: string, accountActorId: string) =>
    providerSignIn(s, actorId, {
      provider: 'google',
      email: actorEmail(s, accountActorId),
    }),
});

/**
 * Sign in by answering the provider exactly as given — any provider, any
 * directory address (seed it first for the unusual ones), share or hide,
 * allow or deny.
 */
export const signInWithProviderAs = scenarioAction({
  name: 'signInWithProviderAs',
  act: (s, actorId: string, answers: ProviderAnswers) =>
    providerSignIn(s, actorId, answers),
});

export type AppleSignInOptions = {
  /** Which of the person's Apple Accounts (default: the Gmail one). */
  readonly account?: AppleAccountKind;
  /** Hide My Email on the first authorization (default: share). */
  readonly hideEmail?: boolean;
};

/**
 * Sign in with Apple. The Gmail-registered Apple Account shares the Google
 * account's verified address, so it lands on the same product account; the
 * iCloud one (or any hidden address) is someone new until linked.
 */
export const signInWithApple = scenarioAction({
  name: 'signInWithApple',
  act: (s, actorId: string, options: AppleSignInOptions = {}) =>
    providerSignIn(s, actorId, {
      provider: 'apple',
      email: actorAppleEmail(s, actorId, options.account ?? 'gmail'),
      emailChoice: options.hideEmail === true ? 'hide' : 'share',
    }),
});

/**
 * "Connect your accounts?" → prove the existing account with `provider`
 * (as `actorId`'s own account there). The parked identity joins it.
 */
export const confirmAccountLink = scenarioAction({
  name: 'confirmAccountLink',
  act: async (
    s,
    actorId: string,
    provider: OauthProviderId,
    /** The existing account's address there (default: the actor's own). */
    email?: string
  ) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.authLinkWith(provider)).tap({ timeoutMs: WAIT_MS });
    await completeProviderSignIn({
      s,
      ui,
      actorId,
      answers: {
        provider,
        email:
          email ??
          (provider === 'apple'
            ? actorAppleEmail(s, actorId, 'gmail')
            : actorEmail(s, actorId)),
      },
      done: () => modalSettled(ui),
    });
    await dismissSignedIn(ui);
  },
});

/** "Connect your accounts?" → keep a separate account instead. */
export const keepSeparateAccount = scenarioAction({
  name: 'keepSeparateAccount',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.authLinkSeparate).tap({ timeoutMs: WAIT_MS });
    await dismissSignedIn(ui);
  },
});

/**
 * The actor is being asked to sign in: the sign-in methods are on their
 * screen. Waiting on an absent id brings the actor's phone to the front
 * first, so a parked actor's screen does not read as empty.
 */
export async function signInAsked(
  s: ProductSim,
  actorId: string
): Promise<boolean> {
  try {
    const ui = await actorUi(s, actorId);
    await ui.get('sim-focus-probe').expect.hidden({ timeoutMs: 1 });
    return await ui.get(Handles.authMethodGoogle).isVisible();
  } catch {
    return false;
  }
}

/**
 * Start a sign-in and walk away from it: the provider window never finishes
 * (the network is down, or the person closes it). The modal is left to show
 * whatever the app makes of that.
 */
export const abandonSignIn = scenarioAction({
  name: 'abandonSignIn',
  act: async (s, actorId: string, provider: OauthProviderId = 'google') => {
    const ui = await actorUi(s, actorId);
    await openSignInModal(ui);
    const method = ui.get(
      provider === 'apple' ? Handles.authMethodApple : Handles.authMethodGoogle
    );
    // A device that never reached the server has no sign-in methods to show
    // (they arrive with the first sync): nothing to tap, so close the modal.
    const offered = await pollUntil(
      s,
      async () => ((await method.isVisible()) ? true : null),
      { maxMs: 2_000, description: 'a sign-in method' }
    ).catch(() => false);
    if (offered) {
      await method.tap({ timeoutMs: WAIT_MS });
      s.sim.browser(actorId).close();
      await ui
        .get(Handles.authSignInFailed)
        .expect.visible({ timeoutMs: WAIT_MS });
    }
    await ui.get(Handles.authModalClose).tap({ timeoutMs: WAIT_MS });
  },
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

/** A tab every composition has: Profile, or the sim's bare home. */
const HOME_TABS = [Handles.tabProfile, Handles.tabSimHome] as const;

/** Leave the Account stack so the tab shell is visible again. */
export const returnToTabs = scenarioAction({
  name: 'returnToTabs',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.navBack).tap();
    await pollUntil(
      s,
      async () => {
        for (const tab of HOME_TABS) {
          if (await ui.get(tab).isVisible()) return true;
        }
        return null;
      },
      { maxMs: WAIT_MS, description: 'the tab bar' }
    );
  },
});
