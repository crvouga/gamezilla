import { describe, expect, test } from 'bun:test';
import { createAuthServerAdapter } from '@pkgs/auth-inhouse-server/create-auth-server-adapter';
import { IdentityLinker } from '@pkgs/auth-inhouse-server/identity-linker';
import type { ProviderIdentity } from '@pkgs/auth-inhouse-server/provider-identity';
import sql from '@pkgs/sql-root-shared/sql';
import type { SessionJson } from './email-link-fixture';
import { emailLinkFixture, googleIdentity } from './email-link-fixture';

const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';

type Fixture = Awaited<ReturnType<typeof emailLinkFixture>>;

/** What a Google callback for `identity` would do, through the same policy. */
function googleSignIn(fixture: Fixture, identity: ProviderIdentity) {
  return fixture.db.transaction((tx) =>
    new IdentityLinker(tx, fixture.deps).signIn(identity, null)
  );
}

function bearer(session: SessionJson): Record<string, string> {
  return { authorization: `Bearer ${session.token}` };
}

describe('email link identity', () => {
  test('the first link creates the account and later links return to it', async () => {
    const fixture = await emailLinkFixture();
    try {
      const first = await fixture.signIn(' Alice@Example.COM ');
      const later = await fixture.signIn(ALICE);
      expect(later.user.id).toBe(first.user.id);
      expect(later.token).not.toBe(first.token);
      // Opening the link proved the mailbox: the identity is the address, verified.
      const identities = await fixture.db.query(
        sql<{
          user_id: string;
          provider: string;
          provider_user_id: string;
          email: string;
          email_verified: unknown;
        }>`SELECT user_id, provider, provider_user_id, email, email_verified FROM idp_accounts`
      );
      expect(identities).toHaveLength(1);
      expect(identities[0]).toMatchObject({
        user_id: first.user.id,
        provider: 'email',
        provider_user_id: ALICE,
        email: ALICE,
      });
      expect([1, true] as unknown[]).toContain(identities[0]?.email_verified);
      expect((await fixture.signIn(BOB)).user.id).not.toBe(first.user.id);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('a link joins the account whose provider-verified address it matches', async () => {
    const fixture = await emailLinkFixture();
    try {
      const google = await googleSignIn(fixture, googleIdentity(ALICE, true));
      if (google.kind !== 'signed_in') throw new Error('Expected an account');
      const session = await fixture.signIn(ALICE);
      expect(session.user.id).toBe(google.userId);
      const listed = await fixture.deps.getSql().query(
        sql<{
          provider: string;
        }>`SELECT provider FROM idp_accounts ORDER BY provider`
      );
      expect(listed.map((row) => row.provider)).toEqual(['email', 'google']);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('an emailed link proves the account a parked identity matched', async () => {
    const fixture = await emailLinkFixture();
    try {
      const account = await fixture.signIn(ALICE);
      const unverified = googleIdentity(ALICE, false);
      const parked = await googleSignIn(fixture, unverified);
      if (parked.kind !== 'link_required')
        throw new Error('Expected proof to be asked for');
      expect(parked.providers).toEqual(['email']);
      const token = await fixture.mailedToken(ALICE, {
        pendingLink: parked.token,
      });
      const proven = await fixture.post('email/confirm', { token });
      expect(proven.status).toBe(200);
      expect(((await proven.json()) as SessionJson).user.id).toBe(
        account.user.id
      );
      expect(await googleSignIn(fixture, unverified)).toMatchObject({
        kind: 'signed_in',
        userId: account.user.id,
      });
      // The proof was spent with the link: it cannot be presented again.
      const again = await fixture.post('email/request', {
        email: ALICE,
        pendingLink: parked.token,
      });
      expect(again.status).toBe(409);
      expect(await again.json()).toEqual({ error: 'expired' });
    } finally {
      await fixture.db.disconnect();
    }
  });

  test("another account's link cannot spend the proof to take the parked identity", async () => {
    const fixture = await emailLinkFixture();
    try {
      const alice = await fixture.signIn(ALICE);
      await fixture.signIn(BOB);
      const unverified = googleIdentity(ALICE, false);
      const parked = await googleSignIn(fixture, unverified);
      if (parked.kind !== 'link_required')
        throw new Error('Expected proof to be asked for');
      const token = await fixture.mailedToken(BOB, {
        pendingLink: parked.token,
      });
      const refused = await fixture.post('email/confirm', { token });
      expect(refused.status).toBe(409);
      expect(await refused.json()).toEqual({ error: 'link_mismatch' });
      expect(refused.headers.get('set-auth-token')).toBeNull();
      // Nothing was attached to either account.
      const holders = await fixture.db.query(
        sql<{
          user_id: string;
        }>`SELECT user_id FROM idp_accounts WHERE provider = ${'google'}`
      );
      expect(holders).toEqual([]);
      expect((await fixture.signIn(ALICE)).user.id).toBe(alice.user.id);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('a link whose address a provider never verified waits for proof instead of joining', async () => {
    const fixture = await emailLinkFixture();
    try {
      const google = await googleSignIn(fixture, googleIdentity(ALICE, false));
      if (google.kind !== 'signed_in') throw new Error('Expected an account');
      const token = await fixture.mailedToken(ALICE);
      const waiting = await fixture.post('email/confirm', { token });
      expect(waiting.status).toBe(409);
      expect(waiting.headers.get('set-auth-token')).toBeNull();
      const asked = (await waiting.json()) as Record<string, string>;
      expect(asked).toMatchObject({
        link_provider: 'email',
        link_providers: 'google',
        link_email: 'a•••e@example.com',
      });
      // Declining keeps the mailbox as its own account.
      const separate = await fixture.post('link/separate', {
        token: asked['link_required'],
      });
      expect(separate.status).toBe(200);
      const own = (await separate.json()) as SessionJson;
      expect(own.user.id).not.toBe(google.userId);
      expect((await fixture.signIn(ALICE)).user.id).toBe(own.user.id);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('the last sign-in method cannot be removed; a removed address no longer reaches the account', async () => {
    const fixture = await emailLinkFixture();
    try {
      const account = await fixture.signIn(ALICE);
      const unlink = () =>
        fixture.post(
          'identities/unlink',
          { provider: 'email' },
          0,
          bearer(account)
        );
      const last = await unlink();
      expect(last.status).toBe(409);
      expect(await last.json()).toEqual({ error: 'last_identity' });
      await fixture.db.transaction((tx) =>
        new IdentityLinker(tx, fixture.deps).link(
          account.user.id,
          googleIdentity('alice@gmail.example', true)
        )
      );
      const sent = await fixture.mailedToken(ALICE);
      const removed = await unlink();
      expect(removed.status).toBe(200);
      expect(await removed.json()).toMatchObject({
        removed: true,
        providerRevoked: false,
        identities: [{ provider: 'google' }],
      });
      // Even a link mailed before the removal opens a different account.
      const res = await fixture.post('email/confirm', { token: sent });
      expect(res.status).toBe(200);
      expect(((await res.json()) as SessionJson).user.id).not.toBe(
        account.user.id
      );
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('deleting an account drops the links still in its mail', async () => {
    const fixture = await emailLinkFixture();
    try {
      const account = await fixture.signIn(ALICE);
      const sent = await fixture.mailedToken(ALICE);
      const kept = await fixture.mailedToken(BOB);
      await createAuthServerAdapter(fixture.deps).deleteUser(account.user.id);
      expect(
        (await fixture.post('email/confirm', { token: sent })).status
      ).toBe(401);
      expect(
        (await fixture.post('email/confirm', { token: kept })).status
      ).toBe(200);
      expect(
        await fixture.db.query(
          sql<{
            id: string;
          }>`SELECT id FROM idp_email_links WHERE email = ${ALICE}`
        )
      ).toEqual([]);
    } finally {
      await fixture.db.disconnect();
    }
  });
});
