/**
 * The account screen's "Sign-in methods": connect another provider, remove
 * one, sign out of every device — tapped the way a person does.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { OauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

import { actorUi, pollUntil, scenarioAction } from './actor-ui';
import type { ProductHarness } from './harness';
import type { AppleAccountKind } from './identity';
import { actorAppleEmail, actorEmail } from './identity';
import { completeProviderSignIn } from './provider-walk';

const WAIT_MS = 15_000;

/** The account screen is up: signed in (its methods) or out ("Sign in"). */
async function onAccountScreen(ui: Driver): Promise<boolean> {
  return (
    (await ui.get(Handles.accountSignInMethods).isVisible()) ||
    (await ui.get(Handles.accountSignIn).isVisible())
  );
}

/** Make sure the account screen is showing, signed in or not. */
export async function openAccountScreen(
  s: ProductHarness,
  ui: Driver
): Promise<void> {
  if (await onAccountScreen(ui)) return;
  await ui.get(Handles.statusCurrentUser).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.globalMenuAccount).tap({ timeoutMs: WAIT_MS });
  await pollUntil(s, async () => ((await onAccountScreen(ui)) ? true : null), {
    maxMs: WAIT_MS,
    description: 'the account screen',
  });
}

/** Go to the account screen from wherever the actor is (a no-op there). */
export const showAccountScreen = scenarioAction({
  name: 'showAccountScreen',
  act: async (s, actorId: string) => {
    await openAccountScreen(s, await actorUi(s, actorId));
  },
});

/** How long a device may take to notice its session ended elsewhere. */
const SESSION_NOTICE_MS = 180_000;

/**
 * Wait on the account screen until the device offers "Sign in": a device
 * whose session ended elsewhere (signed out of every device) shows it once
 * it hears about it.
 */
export const awaitSignedOutScreen = scenarioAction({
  name: 'awaitSignedOutScreen',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await openAccountScreen(s, ui);
    await pollUntil(
      s,
      async () =>
        (await ui.get(Handles.accountSignIn).isVisible()) ? true : null,
      {
        maxMs: SESSION_NOTICE_MS,
        description: 'the account screen offers Sign in',
      }
    );
  },
});

export type ConnectOptions = {
  /** Apple: which of the person's Apple Accounts (default: iCloud). */
  readonly account?: AppleAccountKind;
  readonly hideEmail?: boolean;
  /** Sign in at the provider as another actor's account instead. */
  readonly asActor?: string;
};

function connectEmail(
  s: ProductHarness,
  actorId: string,
  provider: OauthProviderId,
  options: ConnectOptions
): string {
  const who = options.asActor ?? actorId;
  return provider === 'apple'
    ? actorAppleEmail(s, who, options.account ?? 'icloud')
    : actorEmail(s, who);
}

/**
 * Tap "Connect" on a provider row and walk its window. The row then shows
 * "Remove" (linked) or the connect button's error (refused).
 */
export const connectSignInMethod = scenarioAction({
  name: 'connectSignInMethod',
  act: async (
    s,
    actorId: string,
    provider: OauthProviderId,
    options: ConnectOptions = {}
  ) => {
    const ui = await actorUi(s, actorId);
    await openAccountScreen(s, ui);
    await ui
      .get(Handles.accountLinkProvider(provider))
      .tap({ timeoutMs: WAIT_MS });
    // Without a link ticket minted ahead, the app mints one before it opens
    // the provider's window: wait for the window, as a person would.
    await pollUntil(
      s,
      () => Promise.resolve(s.harness.browser(actorId).tab() !== null || null),
      { maxMs: WAIT_MS, description: `the ${provider} window` }
    );
    await completeProviderSignIn({
      s,
      ui,
      actorId,
      answers: {
        provider,
        email: connectEmail(s, actorId, provider, options),
        emailChoice: options.hideEmail === true ? 'hide' : 'share',
      },
      done: () => Promise.resolve(s.harness.browser(actorId).tab() === null),
    });
  },
});

/**
 * "Remove" on a provider row, confirmed in the modal, and its "Removed" face
 * dismissed — left up, it covers the account screen.
 */
export const removeSignInMethod = scenarioAction({
  name: 'removeSignInMethod',
  act: async (s, actorId: string, provider: OauthProviderId) => {
    const ui = await actorUi(s, actorId);
    await openAccountScreen(s, ui);
    await ui
      .get(Handles.accountUnlinkProvider(provider))
      .tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.accountUnlinkConfirm).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.accountUnlinkDone).tap({ timeoutMs: WAIT_MS });
  },
});

/** "Sign out of all devices", confirmed. */
export const signOutEverywhere = scenarioAction({
  name: 'signOutEverywhere',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await openAccountScreen(s, ui);
    await ui.get(Handles.accountSignOutEverywhere).tap({ timeoutMs: WAIT_MS });
    await ui
      .get(Handles.accountSignOutEverywhereConfirm)
      .tap({ timeoutMs: WAIT_MS });
    // Signing out swaps the account chrome; the success face may already be
    // gone with it, as with a plain sign-out.
    await ui.get(Handles.accountSignIn).expect.visible({ timeoutMs: WAIT_MS });
    const done = ui.get(Handles.accountSignOutEverywhereDone);
    if (await done.isVisible()) await done.tap({ timeoutMs: WAIT_MS });
  },
});

/**
 * "Remove" on a provider row, the way a person tries it: if the app asks to
 * confirm, confirm. For the account's only method the app never asks, so
 * nothing is removed.
 */
export const tryRemoveSignInMethod = scenarioAction({
  name: 'tryRemoveSignInMethod',
  act: async (s, actorId: string, provider: OauthProviderId) => {
    const ui = await actorUi(s, actorId);
    await openAccountScreen(s, ui);
    await ui
      .get(Handles.accountUnlinkProvider(provider))
      .tap({ timeoutMs: WAIT_MS });
    const confirm = ui.get(Handles.accountUnlinkConfirm);
    const asked = await pollUntil(
      s,
      async () => ((await confirm.isVisible()) ? true : null),
      { maxMs: 2_000, description: 'the remove confirmation' }
    ).catch(() => false);
    if (asked) await confirm.tap({ timeoutMs: WAIT_MS });
  },
});

const SHOWN_PROVIDERS: readonly OauthProviderId[] = ['apple', 'google'];

/**
 * The sign-in methods the account screen lists as connected (each has a
 * "Remove"), sorted; `[]` when the screen shows the person signed out, and
 * `null` while the screen cannot be reached.
 */
export async function signInMethodsShown(
  s: ProductHarness,
  actorId: string
): Promise<string[] | null> {
  const ui = await actorUi(s, actorId);
  try {
    await openAccountScreen(s, ui);
  } catch {
    return null;
  }
  const shown: string[] = [];
  for (const provider of SHOWN_PROVIDERS) {
    if (await ui.get(Handles.accountUnlinkProvider(provider)).isVisible()) {
      shown.push(provider);
    }
  }
  return shown;
}

/** True when the actor's account screen offers "Sign in": signed out. */
export async function signedOutShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (await ui.get(Handles.accountSignIn).isVisible()) return true;
  try {
    await openAccountScreen(s, ui);
  } catch {
    return false;
  }
  return ui.get(Handles.accountSignIn).isVisible();
}

/** The text a provider's row shows on the account screen, errors included. */
export async function signInMethodRowText(
  s: ProductHarness,
  actorId: string,
  provider: OauthProviderId
): Promise<string> {
  const ui = await actorUi(s, actorId);
  return (await ui.get(Handles.accountSignInMethod(provider)).text()) ?? '';
}

/** True while the app asks the actor to prove an address match. */
export async function accountMatchPromptShown(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return ui.get(Handles.authLinkRequired).isVisible();
}
