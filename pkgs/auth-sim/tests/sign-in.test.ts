import { describe, expect, test } from 'bun:test';
import {
  auth,
  invariantViolations,
  lastOutcome,
  type ProviderAnswers,
  signedInUser,
  signIn,
} from '@pkgs/auth-sim';

function as(
  email: string,
  extra: Partial<ProviderAnswers> = {}
): ProviderAnswers {
  return { email, consent: 'allow', emailChoice: 'share', ...extra };
}

describe('auth sim: sign-in against both providers', () => {
  test('google: launch → provider screens → callback → session', async () => {
    await using s = await auth.run({ seed: 1 });
    await s.apply(signIn, {
      clientId: 'c0',
      provider: 'google',
      answers: as('alice@gmail.com'),
    });
    expect(await s.read(lastOutcome, 'c0')).toEqual({ kind: 'ok' });
    expect(await s.read(signedInUser, 'c0')).not.toBeNull();
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('apple: form_post callback, hidden email, session', async () => {
    await using s = await auth.run({ seed: 2 });
    await s.apply(signIn, {
      clientId: 'c0',
      provider: 'apple',
      answers: as('alice@icloud.com', { emailChoice: 'hide' }),
    });
    expect(await s.read(lastOutcome, 'c0')).toEqual({ kind: 'ok' });
    expect(await s.read(invariantViolations)).toEqual([]);
  });
});
