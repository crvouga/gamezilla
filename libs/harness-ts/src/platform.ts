/**
 * Steps every product sub may use: who is in the scenario, how they sign
 * in, and what the network does. Sub packages import this from their
 * steps entry.
 */

import { expect } from 'bun:test';

import { hostLimit } from '@pkgs/gherkin-shared-ts/registry';
import { ActionNotEnabled } from '@pkgs/harness-root-shared-ts/probe';
import {
  partition,
  refreshActorConnection,
  refreshActorQueries,
  restartApp,
  restoreNetwork,
} from './actions';
import {
  claimActorUsername,
  returnToTabs,
  signInAsked,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signOut,
} from './auth-actions';
import { Given, Then, When } from './define';
import { accountIdOf, signedInAccountOf } from './identity';
import { connectionMissing } from './network-notices';
import { caps } from './observations';
import type { Actor } from './parameter-types';
import { focusActor, openAccount } from './shell-actions';
import type { HarnessWorld } from './spec-world';
import { remember, signedInAccountKey } from './spec-world';

const SECOND_MS = 1_000;

type PhoneOfflineHook = (w: HarnessWorld, actor: Actor) => Promise<void>;
let phoneOfflineHook: PhoneOfflineHook | null = null;

/** A sub records what this device held before the phone loses the connection. */
export function setPhoneOfflineHook(hook: PhoneOfflineHook): void {
  phoneOfflineHook = hook;
}

export async function notePhoneOffline(
  w: HarnessWorld,
  actor: Actor
): Promise<void> {
  if (phoneOfflineHook !== null) await phoneOfflineHook(w, actor);
}

/** The actor id of `actor`'s second device, signed into the same account. */
export function otherDevice(actor: string): string {
  return `${actor}_phone`;
}

/**
 * Cut `actor` off from the server. A live browser (`HARNESS_MODE=real|stack`)
 * cannot cut its own connection: the host lacks the `partition` capability
 * and the action is not enabled. That is a harness limit, so the scenario
 * ends here instead of failing.
 */
export async function cutConnection(
  w: Pick<HarnessWorld, 's'>,
  actor: string
): Promise<void> {
  if (!(await w.s.read(caps)).includes('partition')) {
    const refused = await w.s.apply(partition, actor).then(
      () => null,
      (error: unknown) => error
    );
    expect(refused).toBeInstanceOf(ActionNotEnabled);
    throw hostLimit('this host cannot cut the connection');
  }
  await w.s.apply(partition, actor);
  await w.s.apply(refreshActorConnection, actor);
  await w.s.apply(refreshActorQueries, actor);
}

async function signIn(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(signInWithGoogle, actor);
  await w.s.apply(claimActorUsername, actor);
  await w.s.apply(returnToTabs, actor);
}

Given('{actor} is signed in', async (w, actor: Actor) => {
  await signIn(w, actor);
});

Given('{actor} and {actor} are signed in', async (w, a: Actor, b: Actor) => {
  await signIn(w, a);
  await signIn(w, b);
});

Given('{actor} is a guest', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
});

Given(
  '{actor} and {actor} are guests',
  async (w, first: Actor, second: Actor) => {
    await w.s.apply(focusActor, first);
    await w.s.apply(focusActor, second);
    await w.s.apply(focusActor, first);
  }
);

Given('{actor} is signed in with Google', async (w, actor: Actor) => {
  await w.s.apply(signInWithGoogle, actor);
  const account = await w.s.read(signedInAccountOf, actor);
  if (account === null) throw new Error(`${actor} did not sign in`);
  remember(w, signedInAccountKey(actor), account);
});

When('{actor} signs in with Google', async (w, actor: Actor) => {
  await w.s.apply(signInWithGoogle, actor);
});

Then('{actor} has a signed-in account', async (w, actor: Actor) => {
  const account = await w.s.read(signedInAccountOf, actor);
  expect(account).not.toBeNull();
});

Then('{actor} (still )has no account', async (w, actor: Actor) => {
  expect(await w.s.read(accountIdOf, actor)).toBeNull();
});

Then('{actor} is asked to sign in', async (w, actor: Actor) => {
  expect(await w.s.read(signInAsked, actor)).toBe(true);
});

Then(
  '{actor} is asked to sign in within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((harness) => signInAsked(harness, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Given(
  '{actor} is also signed in on another device',
  async (w, actor: Actor) => {
    // The other device is this person. Claim the account here first when
    // this device is still a guest, so both devices are one account.
    const offline = await w.s.read((s) =>
      s.session.network
        .partitions()
        .some((pair) => pair[0] === actor || pair[1] === actor)
    );
    if (!offline && (await w.s.read(signedInAccountOf, actor)) === null) {
      await w.s.apply(signInWithGoogle, actor);
    }
    await w.s.apply(signInWithGoogleAsAccount, otherDevice(actor), actor);
    await w.s.apply(returnToTabs, otherDevice(actor));
  }
);

Given('{actor} has signed out', async (w, actor: Actor) => {
  await w.s.apply(openAccount, actor);
  await w.s.apply(signOut, actor);
});

Given('{actor} is offline', async (w, actor: Actor) => {
  await cutConnection(w, actor);
});

Given('{actor} and {actor} are offline', async (w, a: Actor, b: Actor) => {
  await cutConnection(w, a);
  await cutConnection(w, b);
});

When('{actor} loses the connection', async (w, actor: Actor) => {
  await cutConnection(w, actor);
});

Given('the connection has come back', async (w) => {
  await w.s.apply(restoreNetwork);
});

When('the connection comes back', async (w) => {
  await w.s.apply(restoreNetwork);
});

Given('{actor} has closed and reopened the app', async (w, actor: Actor) => {
  await w.s.apply(restartApp, actor);
});

Given(
  '{actor} and {actor} have closed and reopened the app',
  async (w, a: Actor, b: Actor) => {
    await w.s.apply(restartApp, a);
    await w.s.apply(restartApp, b);
  }
);

When('{actor} closes and reopens the app', async (w, actor: Actor) => {
  await w.s.apply(restartApp, actor);
});

Then(
  '{actor} is told the connection is missing within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((s) => connectionMissing(s, actor), {
      maxMs: seconds * 1_000,
    });
  }
);
