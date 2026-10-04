/**
 * `specs/profile/account-sign-in.qnt` against the profile composition: Alice
 * on two devices (actors `alice` and `bob`), signing in with her three
 * outside accounts, connecting and removing the account's sign-in methods,
 * signing out here or everywhere, and losing the connection. The model's
 * state is read back as everyone else knows it (the account each device is
 * signed in to, each account's sign-in methods) and from each device (the
 * sign-in methods it shows).
 */

import { abandonSignIn, signInWithProviderAs, signOut } from '@libs/harness/auth-actions';
import { actorAppleEmail, actorEmail, localSignInMethodsOf, serverSignInMethodsOf, signedInAccountOf } from '@libs/harness/identity';
import { connectSignInMethod, removeSignInMethod, signOutEverywhere } from '@libs/harness/sign-in-method-actions';
import { focusActor } from '@libs/harness/shell-actions';
import { partition, restoreNetwork } from '@libs/harness/actions';
import { partitioned } from '@libs/harness/observations';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { ProductHarness } from '@libs/harness/harness';
import {
  awaitSignedOutScreen,
  showAccountScreen,
} from '@libs/harness/sign-in-method-actions';
import {
  deviceShowsSignedIn,
  outsideIdentityAccount,
  registeredAccounts,
} from '@libs/harness/sign-in-state-reads';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import type { Picks } from '@pkgs/quint-shared/registry';

const DEVICES = ['alice', 'bob'] as const;

/** Whose outside accounts every device signs in with. */
const PERSON = 'alice';

type OutsideAccount = 'google' | 'appleShared' | 'appleHidden';
type SignInMethod = 'google' | 'apple';

function pick(picks: Picks, name: string): string {
  return String(picks[name]);
}

function outsideAccountOf(picks: Picks): OutsideAccount {
  const outsideAccount = pick(picks, 'identity');
  if (
    outsideAccount !== 'google' &&
    outsideAccount !== 'appleShared' &&
    outsideAccount !== 'appleHidden'
  ) {
    throw new Error(`unknown outside account ${outsideAccount}`);
  }
  return outsideAccount;
}

function signInMethodOf(outsideAccount: OutsideAccount): SignInMethod {
  return outsideAccount === 'google' ? 'google' : 'apple';
}

function signInMethodPick(picks: Picks): SignInMethod {
  return pick(picks, 'provider') === 'apple' ? 'apple' : 'google';
}

/** Account ids, numbered in the order the model starts them. */
function accountKey(id: string): string {
  return `account:${id}`;
}

function accountName(w: QuintHarnessWorld, id: string): QuintValue {
  const name = w.memo.get(accountKey(id));
  return typeof name === 'number' ? name : `unknown account ${id}`;
}

function knownAccounts(w: QuintHarnessWorld): readonly [string, number][] {
  const out: [string, number][] = [];
  for (const [key, name] of w.memo) {
    if (key.startsWith('account:') && typeof name === 'number') {
      out.push([key.slice('account:'.length), name]);
    }
  }
  return out;
}

function remember(w: QuintHarnessWorld, id: string): void {
  if (w.memo.has(accountKey(id))) return;
  w.memo.set(accountKey(id), knownAccounts(w).length + 1);
}

function isOffline(s: ProductHarness, device: string): boolean {
  return partitioned(s).some((pair) => pair.split('|').includes(device));
}

/**
 * Online devices that were signed out everywhere (or are back online after
 * that) are given the time to show "Sign in" again, so the next step starts
 * from what the model says they show.
 */
async function awaitSignedOutEverywhereShown(
  w: QuintHarnessWorld
): Promise<void> {
  for (const device of DEVICES) {
    if (await w.s.read(isOffline, device)) continue;
    if ((await w.s.read(signedInAccountOf, device)) !== null) continue;
    await w.s.apply(awaitSignedOutScreen, device);
  }
}

bindQuintModel<QuintHarnessWorld>({
  model: 'account-sign-in',
  traces: 8,
  maxSteps: 20,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      for (const device of DEVICES) await w.s.apply(focusActor, device);
    },
    signIn: async (w, picks) => {
      const device = pick(picks, 'device');
      const outsideAccount = outsideAccountOf(picks);
      const email =
        outsideAccount === 'google'
          ? await w.s.read(actorEmail, PERSON)
          : await w.s.read(
              actorAppleEmail,
              PERSON,
              outsideAccount === 'appleShared' ? 'gmail' : 'icloud'
            );
      await w.s.apply(focusActor, device);
      await w.s.apply(signInWithProviderAs, device, {
        provider: signInMethodOf(outsideAccount),
        email,
        ...(outsideAccount === 'google'
          ? {}
          : {
              emailChoice: outsideAccount === 'appleHidden' ? 'hide' : 'share',
            }),
      });
      const account = await w.s.read(signedInAccountOf, device);
      if (account === null) {
        throw new Error(`${device} is not signed in after ${outsideAccount}`);
      }
      remember(w, account);
    },
    abandonSignIn: async (w, picks) => {
      const device = pick(picks, 'device');
      await w.s.apply(focusActor, device);
      await w.s.apply(abandonSignIn, device, signInMethodPick(picks));
    },
    signOut: async (w, picks) => {
      const device = pick(picks, 'device');
      await w.s.apply(focusActor, device);
      await w.s.apply(showAccountScreen, device);
      await w.s.apply(signOut, device);
    },
    connectSignInMethod: async (w, picks) => {
      const device = pick(picks, 'device');
      const outsideAccount = outsideAccountOf(picks);
      await w.s.apply(focusActor, device);
      await w.s.apply(
        connectSignInMethod,
        device,
        signInMethodOf(outsideAccount),
        {
          asActor: PERSON,
          ...(outsideAccount === 'google'
            ? {}
            : {
                account: outsideAccount === 'appleShared' ? 'gmail' : 'icloud',
                hideEmail: outsideAccount === 'appleHidden',
              }),
        }
      );
    },
    removeSignInMethod: async (w, picks) => {
      const device = pick(picks, 'device');
      await w.s.apply(focusActor, device);
      await w.s.apply(removeSignInMethod, device, signInMethodPick(picks));
    },
    signOutEverywhere: async (w, picks) => {
      const device = pick(picks, 'device');
      await w.s.apply(focusActor, device);
      await w.s.apply(signOutEverywhere, device);
      await awaitSignedOutEverywhereShown(w);
    },
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, pick(picks, 'device'));
    },
    reconnect: async (w) => {
      await w.s.apply(restoreNetwork);
      await awaitSignedOutEverywhereShown(w);
    },
  },
  observe: async (w) => {
    const account = new Map<QuintValue, QuintValue>();
    const signInMethodsShown = new Map<QuintValue, QuintValue>();
    for (const device of DEVICES) {
      const id = await w.quiet.read(signedInAccountOf, device);
      if (id === null) continue;
      account.set(device, accountName(w, id));
      signInMethodsShown.set(
        device,
        new Set<QuintValue>(
          await w.quiet.read(localSignInMethodsOf, device, id)
        )
      );
    }
    const signInMethods = new Map<QuintValue, QuintValue>();
    for (const [id, name] of knownAccounts(w)) {
      signInMethods.set(
        name,
        new Set<QuintValue>(await w.quiet.read(serverSignInMethodsOf, id))
      );
    }
    const signsInto = new Map<QuintValue, QuintValue>();
    for (const identity of ['google', 'appleShared', 'appleHidden'] as const) {
      const address =
        identity === 'google'
          ? await w.quiet.read(actorEmail, PERSON)
          : await w.quiet.read(
              actorAppleEmail,
              PERSON,
              identity === 'appleShared' ? 'gmail' : 'icloud'
            );
      const id = await w.quiet.read(
        outsideIdentityAccount,
        signInMethodOf(identity),
        address
      );
      signsInto.set(identity, id === null ? 0 : accountName(w, id));
    }
    const offline = new Set<QuintValue>();
    const showsSignedIn = new Set<QuintValue>();
    for (const device of DEVICES) {
      if (await w.quiet.read(isOffline, device)) offline.add(device);
      if (await w.quiet.read(deviceShowsSignedIn, device))
        showsSignedIn.add(device);
    }
    return {
      account,
      signInMethods,
      signInMethodsShown,
      signsInto,
      accountCount: (await w.quiet.read(registeredAccounts)).length,
      offline,
      showsSignedIn,
    };
  },
});
