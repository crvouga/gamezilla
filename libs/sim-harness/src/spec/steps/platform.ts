/**
 * Steps every product feature may use: who is in the scenario, how they sign
 * in, and what the network does. Feature packages import this from their
 * steps entry.
 */

import { expect } from 'bun:test';

import { hostLimit } from '@pkgs/gherkin/registry';
import { ActionNotEnabled } from '@pkgs/sim';
import { partition, restartApp, restoreNetwork } from '../../system/actions';
import { returnToTabs, signInWithGoogle } from '../../system/auth-actions';
import { signedInAccountOf } from '../../system/identity';
import { caps } from '../../system/observations';
import { focusActor } from '../../system/shell-actions';
import { type Actor, Given, Then, When } from '../define';
import { remember, type SimWorld, signedInAccountKey } from '../world';

async function signIn(w: SimWorld, actor: Actor): Promise<void> {
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

/**
 * A live browser (`SIM_MODE=real|stack`) cannot cut its own connection: the
 * host lacks the `partition` capability and the action is not enabled. That
 * is a harness limit, so the scenario ends here instead of failing.
 */
When('{actor} loses the connection', async (w, actor: Actor) => {
  if (!(await w.s.read(caps)).includes('partition')) {
    const refused = await w.s.apply(partition, actor).then(
      () => null,
      (error: unknown) => error
    );
    expect(refused).toBeInstanceOf(ActionNotEnabled);
    throw hostLimit('this host cannot cut the connection');
  }
  await w.s.apply(partition, actor);
});

When('the connection comes back', async (w) => {
  await w.s.apply(restoreNetwork);
});

When('{actor} closes and reopens the app', async (w, actor: Actor) => {
  await w.s.apply(restartApp, actor);
});
