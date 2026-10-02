/**
 * Steps every product feature may use: who is in the scenario, how they sign
 * in, and what the network does. Feature packages import this from their
 * steps entry.
 */

import { expect } from 'bun:test';

import { hostLimit } from '@pkgs/gherkin/registry';
import { ActionNotEnabled } from '@pkgs/harness';
import { partition, restartApp, restoreNetwork } from '../../system/actions';
import {
  returnToTabs,
  signInAsked,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signOut,
} from '../../system/auth-actions';
import { accountIdOf, signedInAccountOf } from '../../system/identity';
import { caps } from '../../system/observations';
import { focusActor, openAccount } from '../../system/shell-actions';
import { type Actor, Given, Then, When } from '../define';
import { type HarnessWorld, remember, signedInAccountKey } from '../world';

const SECOND_MS = 1_000;

/** The actor id of `actor`'s second device, signed into the same account. */
export function otherDevice(actor: Actor): string {
  return `${actor}_phone`;
}

/**
 * Cut `actor` off from the server. A live browser (`HARNESS_MODE=real|stack`)
 * cannot cut its own connection: the host lacks the `partition` capability
 * and the action is not enabled. That is a harness limit, so the scenario
 * ends here instead of failing.
 */
export async function cutConnection(
  w: HarnessWorld,
  actor: Actor
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
  // Let the disconnected transport publish its status before the next choice.
  await w.s.advanceTime(1_000);
}

async function signIn(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(signInWithGoogle, actor);
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

When('{actor} closes and reopens the app', async (w, actor: Actor) => {
  await w.s.apply(restartApp, actor);
});
