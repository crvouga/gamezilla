import { describe, expect, test } from 'bun:test';
import { AUTH_SESSION_TTL_MS } from '@pkgs/auth-inhouse/shared';
import {
  auth,
  clientBearers,
  invariantViolations,
  lastOutcome,
  linkProvider,
  sessionUser,
  setOnline,
  signedInUser,
  signIn,
  signOut,
  signOutEverywhere,
  stealBearer,
  unlinkProvider,
} from '@pkgs/auth-sim';

import { step } from './support';

describe('auth sim: offline and back online', () => {
  test('signing in offline fails cleanly; back online it works', async () => {
    await using s = await auth.run({ seed: 201 });
    await s.apply(setOnline, { clientId: 'c0', online: false });
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    expect((await s.read(lastOutcome, 'c0'))?.kind).toBe('failed');
    expect(await s.read(signedInUser, 'c0')).toBeNull();
    await s.apply(setOnline, { clientId: 'c0', online: true });
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    expect(await s.read(signedInUser, 'c0')).not.toBeNull();
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('signing out offline forgets the device; the server session survives', async () => {
    await using s = await auth.run({ seed: 202 });
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    const bearer = (await s.read(clientBearers))['c0'] ?? '';
    await s.apply(setOnline, { clientId: 'c0', online: false });
    await s.apply(signOut, 'c0');
    expect((await s.read(clientBearers))['c0']).toBeNull();
    expect(await s.read(sessionUser, bearer)).not.toBeNull();
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('linking or unlinking offline changes nothing', async () => {
    await using s = await auth.run({ seed: 203 });
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    const alice = await s.read(signedInUser, 'c0');
    await s.apply(setOnline, { clientId: 'c0', online: false });
    await s.apply(linkProvider, step('c0', 'apple', 'alice@icloud.com'));
    expect((await s.read(lastOutcome, 'c0'))?.kind).toBe('failed');
    await s.apply(unlinkProvider, { clientId: 'c0', provider: 'google' });
    expect((await s.read(lastOutcome, 'c0'))?.kind).toBe('failed');
    await s.apply(setOnline, { clientId: 'c0', online: true });
    expect(await s.read(signedInUser, 'c0')).toBe(alice);
    expect(await s.read(invariantViolations)).toEqual([]);
  });
});

describe('auth sim: sessions', () => {
  test('sessions expire after their TTL', async () => {
    await using s = await auth.run({ seed: 211 });
    await s.apply(signIn, step('c0', 'apple', 'dan@icloud.com'));
    await s.advanceTime(AUTH_SESSION_TTL_MS + 1);
    expect(await s.read(signedInUser, 'c0')).toBeNull();
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('sign out everywhere ends every device of the account', async () => {
    await using s = await auth.run({
      seed: 212,
      args: { fabric: 'mockingbird-sqlite', clientCount: 3 },
    });
    await s.apply(signIn, step('c0', 'google', 'bob@gmail.com'));
    await s.apply(signIn, step('c1', 'google', 'bob@gmail.com'));
    await s.apply(signIn, step('c2', 'google', 'alice@gmail.com'));
    await s.apply(signOutEverywhere, 'c0');
    expect(await s.read(signedInUser, 'c0')).toBeNull();
    expect(await s.read(signedInUser, 'c1')).toBeNull();
    expect(await s.read(signedInUser, 'c2')).not.toBeNull();
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('a stolen bearer works until its session is revoked', async () => {
    await using s = await auth.run({ seed: 213 });
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    await s.apply(stealBearer, { from: 'c0', to: 'c1' });
    expect(await s.read(signedInUser, 'c1')).toBe(
      await s.read(signedInUser, 'c0')
    );
    await s.apply(signOut, 'c0');
    expect(await s.read(signedInUser, 'c1')).toBeNull();
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('linking retires the old session and keeps the account', async () => {
    await using s = await auth.run({ seed: 214 });
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    await s.apply(stealBearer, { from: 'c0', to: 'c1' });
    await s.apply(linkProvider, step('c0', 'apple', 'alice@icloud.com'));
    expect(await s.read(signedInUser, 'c0')).not.toBeNull();
    expect(await s.read(signedInUser, 'c1')).toBeNull();
    expect(await s.read(invariantViolations)).toEqual([]);
  });
});
