/**
 * The account screen's "Sign-in methods": connect another provider, remove
 * one, sign out of every device — tapped the way a person does.
 */

import { Handles } from '@libs/test-ids';
import type { OauthProviderId } from '@pkgs/auth/shared';
import type { Driver } from '@pkgs/ui-testing';

import { actorUi, pollUntil, scenarioAction } from './actor-ui';
import { type AppleAccountKind, actorAppleEmail, actorEmail } from './identity';
import { completeProviderSignIn } from './provider-walk';
import type { ProductSim } from './sim';

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
  s: ProductSim,
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

export type ConnectOptions = {
  /** Apple: which of the person's Apple Accounts (default: iCloud). */
  readonly account?: AppleAccountKind;
  readonly hideEmail?: boolean;
  /** Sign in at the provider as another actor's account instead. */
  readonly asActor?: string;
};

function connectEmail(
  s: ProductSim,
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
    await completeProviderSignIn({
      s,
      ui,
      actorId,
      answers: {
        provider,
        email: connectEmail(s, actorId, provider, options),
        emailChoice: options.hideEmail === true ? 'hide' : 'share',
      },
      done: () => Promise.resolve(s.sim.browser(actorId).tab() === null),
    });
  },
});

/** "Remove" on a provider row, confirmed in the modal. */
export const removeSignInMethod = scenarioAction({
  name: 'removeSignInMethod',
  act: async (s, actorId: string, provider: OauthProviderId) => {
    const ui = await actorUi(s, actorId);
    await openAccountScreen(s, ui);
    await ui
      .get(Handles.accountUnlinkProvider(provider))
      .tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.accountUnlinkConfirm).tap({ timeoutMs: WAIT_MS });
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
