import { describe, expect, test } from 'bun:test';
import { IdentityLinker } from '@pkgs/auth-inhouse-server/identity-linker';
import type { ProviderIdentity } from '@pkgs/auth-inhouse-server/provider-identity';
import { PASSWORD, passwordFixture } from './password-fixture';

const oauthIdentity: ProviderIdentity = {
  provider: 'google',
  providerUserId: 'google-alice',
  email: 'alice@example.com',
  emailVerified: true,
  isPrivateEmail: false,
  name: 'Alice',
  picture: null,
  accessToken: null,
  refreshToken: null,
};

describe('password identity security', () => {
  test('a matching verified OAuth address waits for proof of the password account', async () => {
    const fixture = await passwordFixture();
    try {
      const registration = await fixture.post('password/register', {
        email: oauthIdentity.email,
        password: PASSWORD,
      });
      const account = (await registration.json()) as {
        user: { id: string };
        token: string;
      };
      const parked = await fixture.db.transaction((tx) =>
        new IdentityLinker(tx, fixture.deps).signIn(oauthIdentity, null)
      );
      expect(parked.kind).toBe('link_required');
      if (parked.kind !== 'link_required')
        throw new Error('Expected password proof');
      expect(parked.providers).toEqual(['password']);
      const response = await fixture.post('password/sign-in', {
        email: oauthIdentity.email,
        password: PASSWORD,
        pendingLink: parked.token,
      });
      expect(response.status).toBe(200);
      expect(
        ((await response.json()) as { user: { id: string } }).user.id
      ).toBe(account.user.id);
      const identities = await fixture.deps
        .getSql()
        .transaction((tx) =>
          new IdentityLinker(tx, fixture.deps).signIn(oauthIdentity, null)
        );
      expect(identities).toMatchObject({
        kind: 'signed_in',
        userId: account.user.id,
      });
      expect(
        (
          await fixture.post('password/sign-in', {
            email: oauthIdentity.email,
            password: PASSWORD,
            pendingLink: parked.token,
          })
        ).status
      ).toBe(409);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('another password account cannot consume proof to attach an identity', async () => {
    const fixture = await passwordFixture();
    try {
      for (const email of ['alice@example.com', 'bob@example.com'])
        await fixture.post('password/register', { email, password: PASSWORD });
      const parked = await fixture.db.transaction((tx) =>
        new IdentityLinker(tx, fixture.deps).signIn(oauthIdentity, null)
      );
      if (parked.kind !== 'link_required')
        throw new Error('Expected password proof');
      expect(
        (
          await fixture.post('password/sign-in', {
            email: 'bob@example.com',
            password: PASSWORD,
            pendingLink: parked.token,
          })
        ).status
      ).toBe(409);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('the last password identity cannot be removed; removing one of two revokes its credential', async () => {
    const fixture = await passwordFixture();
    try {
      const response = await fixture.post('password/register', {
        email: oauthIdentity.email,
        password: PASSWORD,
      });
      const account = (await response.json()) as {
        user: { id: string };
        token: string;
      };
      const headers = { authorization: `Bearer ${account.token}` };
      expect(
        (
          await fixture.post(
            'identities/unlink',
            { provider: 'password' },
            0,
            headers
          )
        ).status
      ).toBe(409);
      await fixture.db.transaction((tx) =>
        new IdentityLinker(tx, fixture.deps).link(
          account.user.id,
          oauthIdentity
        )
      );
      expect(
        (
          await fixture.post(
            'identities/unlink',
            { provider: 'password' },
            0,
            headers
          )
        ).status
      ).toBe(200);
      expect(
        (
          await fixture.post('password/sign-in', {
            email: oauthIdentity.email,
            password: PASSWORD,
          })
        ).status
      ).toBe(401);
    } finally {
      await fixture.db.disconnect();
    }
  });
});
