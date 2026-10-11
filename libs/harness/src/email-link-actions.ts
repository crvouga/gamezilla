/**
 * Emailed sign-in links, as a Synthetic User's device uses them. Email
 * sign-in exists for Synthetic Users alone: a device offers it only after
 * {@link hostSyntheticUser}, and a person's device never does. The mail
 * itself is not this package's to read: the caller takes the link from the
 * internal inbox over the worker control plane and hands it to
 * {@link signInWithEmailLink}.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { actorUi, pollUntil, scenarioAction } from './actor-ui';
import { dismissSignedIn, openSignInModal } from './auth-actions';
import type { ProductHarness } from './harness';
import { productExtra } from './harness';

const WAIT_MS = 20_000;

/**
 * The actor's device is a Synthetic User's application host from its first
 * launch on. Simulated devices only: a real browser loads the app people
 * use, which never offers email sign-in.
 */
export const hostSyntheticUser = scenarioAction({
  name: 'hostSyntheticUser',
  act: (s, actorId: string) => {
    if (productExtra(s).ui.kind !== 'solid-dom')
      throw new Error(
        "Email sign-in is offered only by a Synthetic User's application host; a browser device runs the app people use"
      );
    if (s.actors.has(actorId))
      throw new Error(`${actorId}'s app is already running`);
    s.harness.hostSyntheticUser(actorId);
    return Promise.resolve();
  },
});

/**
 * Sign in → "Continue with email" → the address → "Email me a link", and
 * stop at "Check your email", where the link is pasted.
 */
export const requestEmailLink = scenarioAction({
  name: 'requestEmailLink',
  act: async (s, actorId: string, email: string) => {
    const ui = await actorUi(s, actorId);
    await openSignInModal(ui);
    await ui.get(Handles.authMethodEmail).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.authEmailAddress).input(email);
    await ui.get(Handles.authEmailRequestLink).tap();
    await ui.get(Handles.authEmailLink).expect.visible({ timeoutMs: WAIT_MS });
  },
});

/**
 * Paste the link into "Check your email" and sign in, then stop where the
 * sign-in surface lands: signed in (dismissed), or "Sign-in failed".
 */
export const signInWithEmailLink = scenarioAction({
  name: 'signInWithEmailLink',
  act: async (s, actorId: string, link: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.authEmailLink).input(link);
    await ui.get(Handles.authEmailSignIn).tap();
    const succeeded = await pollUntil(
      s,
      async () => {
        if (await ui.get(Handles.authSignedInDone).isVisible()) return true;
        if (await ui.get(Handles.authSignInFailed).isVisible()) return false;
        return null;
      },
      { maxMs: WAIT_MS, description: 'the emailed-link sign-in outcome' }
    );
    if (succeeded) await dismissSignedIn(ui);
  },
});

/** "Check your email" → back to the address, to ask for a link elsewhere. */
export const changeEmailLinkAddress = scenarioAction({
  name: 'changeEmailLinkAddress',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.authEmailChangeAddress).tap();
    await ui
      .get(Handles.authEmailAddress)
      .expect.visible({ timeoutMs: WAIT_MS });
  },
});

/** Open the sign-in surface and stop at the choice of sign-in method. */
export const startSigningIn = scenarioAction({
  name: 'startSigningIn',
  act: async (s, actorId: string) => {
    await openSignInModal(await actorUi(s, actorId));
  },
});

/**
 * Ask the auth service for a link without the app offering it: what someone
 * does who calls the service directly from a person's device, where no
 * sign-in surface offers email. The service answers the same whether or not
 * it sent anything, so this resolves either way.
 */
export const requestEmailLinkOutsideApp = scenarioAction({
  name: 'requestEmailLinkOutsideApp',
  act: async (s, actorId: string, email: string) => {
    await actorUi(s, actorId);
    const env = await s.harness.client(actorId);
    await env.createAuthClient(env.server).requestEmailLink(email);
  },
});

/**
 * Whether the actor, choosing how to sign in, is offered email. Opens the
 * sign-in surface and leaves it open.
 */
export async function emailSignInOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  if (!(await ui.get(Handles.authModalClose).isVisible()))
    await openSignInModal(ui);
  return ui.get(Handles.authMethodEmail).isVisible();
}

/**
 * Everything the API fleet tried to send out of the simulation. The fleet's
 * only outbound HTTP reaches the simulated providers, so a mail service
 * being called would show here. Empty while no real mail is sent.
 */
export function requestsLeavingTheSimulation(
  s: ProductHarness
): Promise<readonly string[]> {
  return Promise.resolve(s.harness.unansweredServerRequests());
}

/** What "Sign-in failed" tells the actor after a link was refused. */
export async function emailLinkRefusalShown(
  s: ProductHarness,
  actorId: string
): Promise<string | null> {
  return (await actorUi(s, actorId)).get(Handles.authSignInFailed).text();
}
