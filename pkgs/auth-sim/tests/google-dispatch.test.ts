import { describe, expect, test } from 'bun:test';
import {
  type AuthSurface,
  dispatchOauthApprove,
  dispatchOauthStart,
  dispatchSessionExchange,
  startActor,
  startStore,
} from '@pkgs/auth-sim';
import { virtualTimeRuntime } from '@pkgs/sim';

async function bootSurface(): Promise<AuthSurface> {
  const session = await virtualTimeRuntime().open(1);
  const store = await startStore(session, {
    fabric: 'mockingbird-sqlite',
    enableDev: false,
    enableGoogle: true,
  });
  return {
    session,
    store,
    clients: new Map([['c1', startActor()]]),
    fingerprint: null,
    lastStatus: null,
  };
}

async function signInWithGoogle(s: AuthSurface): Promise<string | null> {
  await dispatchOauthStart(s, 'c1', 'google', 'http://callback.test/sso');
  await dispatchOauthApprove(s, 'c1', 'google', 'alice');
  await dispatchSessionExchange(s, 'c1');
  return s.clients.get('c1')?.bearer ?? null;
}

describe('auth-sim google via mockingbird oauth', () => {
  test('approve → exchange yields a bearer', async () => {
    const s = await bootSurface();
    expect(await signInWithGoogle(s)).toBeTruthy();
  });

  test('token fault blocks sign-in until cleared', async () => {
    const s = await bootSurface();
    s.store.google.setTokenFault(true);
    expect(await signInWithGoogle(s)).toBeNull();
    s.store.google.setTokenFault(false);
    expect(await signInWithGoogle(s)).toBeTruthy();
  });
});
