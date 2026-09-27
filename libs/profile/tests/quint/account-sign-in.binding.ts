/**
 * `specs/profile/account-sign-in.qnt` against the profile composition: Alice
 * on two devices (actors `alice` and `bob`), signing in with her three
 * provider accounts, managing the account's sign-in methods, signing out
 * here or everywhere, and losing the connection. The model's state is read
 * back from the server (who each device is signed in as, each account's
 * methods) and from each device's synced copy (the methods it shows).
 */

import {
  abandonSignIn,
  actorAppleEmail,
  actorEmail,
  connectSignInMethod,
  focusActor,
  localSignInMethodsOf,
  partition,
  partitioned,
  removeSignInMethod,
  restoreNetwork,
  serverSignInMethodsOf,
  signedInAccountOf,
  signInWithProviderAs,
  signOut,
  signOutEverywhere,
} from '@libs/sim-harness';
import type { QuintSimWorld } from '@libs/sim-harness/quint/world';
import {
  awaitSignedOutScreen,
  showAccountScreen,
} from '@libs/sim-harness/system/sign-in-method-actions';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import type { QuintValue } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';

const DEVICES = ['alice', 'bob'] as const;

/** Whose provider accounts every device signs in with. */
const PERSON = 'alice';

type Identity = 'google' | 'appleShared' | 'appleHidden';
type OauthProviderId = 'google' | 'apple';

function pick(picks: Picks, name: string): string {
  return String(picks[name]);
}

function identityOf(picks: Picks): Identity {
  const identity = pick(picks, 'identity');
  if (
    identity !== 'google' &&
    identity !== 'appleShared' &&
    identity !== 'appleHidden'
  ) {
    throw new Error(`unknown provider account ${identity}`);
  }
  return identity;
}

function providerOf(identity: Identity): OauthProviderId {
  return identity === 'google' ? 'google' : 'apple';
}

function providerPick(picks: Picks): OauthProviderId {
  return pick(picks, 'provider') === 'apple' ? 'apple' : 'google';
}

/** App account ids, numbered in the order the model creates them. */
function accountKey(id: string): string {
  return `account:${id}`;
}

function accountName(w: QuintSimWorld, id: string): QuintValue {
  const name = w.memo.get(accountKey(id));
  return typeof name === 'number' ? name : `unknown account ${id}`;
}

function knownAccounts(w: QuintSimWorld): readonly [string, number][] {
  const out: [string, number][] = [];
  for (const [key, name] of w.memo) {
    if (key.startsWith('account:') && typeof name === 'number') {
      out.push([key.slice('account:'.length), name]);
    }
  }
  return out;
}

function remember(w: QuintSimWorld, id: string): void {
  if (w.memo.has(accountKey(id))) return;
  w.memo.set(accountKey(id), knownAccounts(w).length + 1);
}

function isOffline(s: ProductSim, device: string): boolean {
  return partitioned(s).some((pair) => pair.split('|').includes(device));
}

/**
 * Online devices whose session has ended (signed out everywhere, or back
 * from offline after that) are given the time to show "Sign in" again, so
 * the next step starts from the screen the model says they show.
 */
async function awaitEndedSessionsNoticed(w: QuintSimWorld): Promise<void> {
  for (const device of DEVICES) {
    if (await w.s.read(isOffline, device)) continue;
    if ((await w.s.read(signedInAccountOf, device)) !== null) continue;
    await w.s.apply(awaitSignedOutScreen, device);
  }
}

bindQuintModel<QuintSimWorld>({
  model: 'account-sign-in',
  traces: 30,
  maxSteps: 20,
  timeoutMs: 120_000,
  actions: {
    init: async (w) => {
      for (const device of DEVICES) await w.s.apply(focusActor, device);
    },
    signIn: async (w, picks) => {
      const device = pick(picks, 'device');
      const identity = identityOf(picks);
      const email =
        identity === 'google'
          ? await w.s.read(actorEmail, PERSON)
          : await w.s.read(
              actorAppleEmail,
              PERSON,
              identity === 'appleShared' ? 'gmail' : 'icloud'
            );
      await w.s.apply(focusActor, device);
      await w.s.apply(signInWithProviderAs, device, {
        provider: providerOf(identity),
        email,
        ...(identity === 'google'
          ? {}
          : { emailChoice: identity === 'appleHidden' ? 'hide' : 'share' }),
      });
      const account = await w.s.read(signedInAccountOf, device);
      if (account === null) {
        throw new Error(`${device} is not signed in after ${identity}`);
      }
      remember(w, account);
    },
    abandonSignIn: async (w, picks) => {
      const device = pick(picks, 'device');
      await w.s.apply(focusActor, device);
      await w.s.apply(abandonSignIn, device, providerPick(picks));
    },
    signOut: async (w, picks) => {
      const device = pick(picks, 'device');
      await w.s.apply(focusActor, device);
      await w.s.apply(showAccountScreen, device);
      await w.s.apply(signOut, device);
    },
    connect: async (w, picks) => {
      const device = pick(picks, 'device');
      const identity = identityOf(picks);
      await w.s.apply(focusActor, device);
      await w.s.apply(connectSignInMethod, device, providerOf(identity), {
        asActor: PERSON,
        ...(identity === 'google'
          ? {}
          : {
              account: identity === 'appleShared' ? 'gmail' : 'icloud',
              hideEmail: identity === 'appleHidden',
            }),
      });
    },
    remove: async (w, picks) => {
      const device = pick(picks, 'device');
      await w.s.apply(focusActor, device);
      await w.s.apply(removeSignInMethod, device, providerPick(picks));
    },
    signOutEverywhere: async (w, picks) => {
      const device = pick(picks, 'device');
      await w.s.apply(focusActor, device);
      await w.s.apply(signOutEverywhere, device);
      await awaitEndedSessionsNoticed(w);
    },
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, pick(picks, 'device'));
    },
    reconnect: async (w) => {
      await w.s.apply(restoreNetwork);
      await awaitEndedSessionsNoticed(w);
    },
  },
  observe: async (w) => {
    const account = new Map<QuintValue, QuintValue>();
    const shown = new Map<QuintValue, QuintValue>();
    for (const device of DEVICES) {
      const id = await w.quiet.read(signedInAccountOf, device);
      if (id === null) continue;
      account.set(device, accountName(w, id));
      shown.set(
        device,
        new Set<QuintValue>(
          await w.quiet.read(localSignInMethodsOf, device, id)
        )
      );
    }
    const methods = new Map<QuintValue, QuintValue>();
    for (const [id, name] of knownAccounts(w)) {
      methods.set(
        name,
        new Set<QuintValue>(await w.quiet.read(serverSignInMethodsOf, id))
      );
    }
    return { account, methods, shown };
  },
});
