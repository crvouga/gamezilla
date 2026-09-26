/**
 * Auth's monkey steps. Each starts from wherever the actor is (tabs or the
 * account screen, nothing modal open), goes to the account screen, and does
 * what a person there could: sign in with either provider (or switch by
 * signing out), connect or remove a sign-in method, sign out of every device.
 * A step that changes the account's sign-in methods waits until the device
 * shows exactly what the server holds — a mirror that never converges is a
 * violation, not noise.
 */

import { Handles } from '@libs/test-ids';
import type { OauthProviderId } from '@pkgs/auth/shared';

import { actorUi, pollUntil } from './actor-ui';
import {
  abandonSignIn,
  signInWithApple,
  signInWithGoogle,
  signOut,
} from './auth-actions';
import {
  localSignInMethodsOf,
  serverSignInMethodsOf,
  signedInAccountOf,
} from './identity';
import {
  connectSignInMethod,
  openAccountScreen,
  removeSignInMethod,
  signOutEverywhere,
} from './sign-in-method-actions';
import type { ProductSim } from './sim';
import { visible, type WalkStep, walkAction } from './walk-action';

const CONVERGE_MS = 20_000;

/** Nothing modal is open and the actor sees the tabs or the account screen. */
async function atRest(step: WalkStep): Promise<boolean> {
  if (step.s.sim.browser(step.actorId).tab() !== null) return false;
  if (await visible(step, Handles.authModalClose)) return false;
  return (
    (await visible(step, Handles.tabProfile)) ||
    (await visible(step, Handles.accountSignInMethods)) ||
    (await visible(step, Handles.accountSignIn))
  );
}

/** The device is cut off from something (the API, the balancer, a provider). */
function cutOff(s: ProductSim, actorId: string): boolean {
  return s.session.network
    .partitions()
    .some(([a, b]) => a === actorId || b === actorId);
}

async function signedIn(step: WalkStep): Promise<boolean> {
  const ui = await actorUi(step.s, step.actorId);
  await openAccountScreen(step.s, ui);
  return !(await ui.get(Handles.accountSignIn).isVisible());
}

/** The device's sign-in methods match the server's, eventually. */
async function mirrorConverges(s: ProductSim, actorId: string): Promise<void> {
  const account = await signedInAccountOf(s, actorId);
  if (account === null) return;
  await pollUntil(
    s,
    async () => {
      const server = (await serverSignInMethodsOf(s, account)).join(',');
      const local = (await localSignInMethodsOf(s, actorId)).join(',');
      return server === local ? true : null;
    },
    {
      maxMs: CONVERGE_MS,
      description: 'sign-in methods on the device match the server',
    }
  );
}

/** Sign in (Google, Apple sharing its address, Apple hiding it) or sign out. */
export const walkSignInOrOut = walkAction({
  name: 'walkSignInOrOut',
  weight: 2,
  applies: atRest,
  act: async (step) => {
    const { s, actorId, pick } = step;
    if (await signedIn(step)) {
      await Promise.resolve(signOut.act(s, actorId));
      return;
    }
    // Offline, the provider window never loads: the person gives up and the
    // app must say sign-in failed, not hang.
    if (cutOff(s, actorId)) {
      await Promise.resolve(
        abandonSignIn.act(s, actorId, pick < 0.5 ? 'google' : 'apple')
      );
      return;
    }
    if (pick < 0.4) await Promise.resolve(signInWithGoogle.act(s, actorId));
    else if (pick < 0.7) await Promise.resolve(signInWithApple.act(s, actorId));
    else {
      await Promise.resolve(
        signInWithApple.act(s, actorId, { account: 'icloud', hideEmail: true })
      );
    }
    const ui = await actorUi(s, actorId);
    // Nothing in a walk parks an identity behind an unverified address, but a
    // person who meets the question can always keep the accounts apart.
    if (await ui.get(Handles.authLinkRequired).isVisible()) {
      await ui.get(Handles.authLinkSeparate).tap();
    }
    await mirrorConverges(s, actorId);
  },
});

/** Connect the provider that is missing, or remove one of two. */
export const walkManageSignInMethods = walkAction({
  name: 'walkManageSignInMethods',
  weight: 2,
  applies: async (step) =>
    !cutOff(step.s, step.actorId) && (await atRest(step)),
  act: async (step) => {
    const { s, actorId, pick } = step;
    if (!(await signedIn(step))) return;
    const linked = await localSignInMethodsOf(s, actorId);
    const provider: OauthProviderId = pick < 0.5 ? 'google' : 'apple';
    if (!linked.includes(provider)) {
      await Promise.resolve(
        connectSignInMethod.act(s, actorId, provider, {
          hideEmail: pick < 0.75,
        })
      );
    } else if (linked.length > 1) {
      await Promise.resolve(removeSignInMethod.act(s, actorId, provider));
    }
    await mirrorConverges(s, actorId);
  },
});

export const walkSignOutEverywhere = walkAction({
  name: 'walkSignOutEverywhere',
  weight: 0.5,
  applies: async (step) =>
    !cutOff(step.s, step.actorId) && (await atRest(step)),
  act: async (step) => {
    if (!(await signedIn(step))) return;
    await Promise.resolve(signOutEverywhere.act(step.s, step.actorId));
  },
});

export const AUTH_WALK_ACTIONS = [
  walkSignInOrOut,
  walkManageSignInMethods,
  walkSignOutEverywhere,
];
