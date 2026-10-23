import { describe, expect, test } from 'bun:test';
import { AUTH_EMAIL_LINK_TTL_MS } from '@pkgs/auth-inhouse-shared-ts/auth-constants';
import { hashAuthSecret } from '@pkgs/auth-inhouse-shared-ts/token-hash';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import sql from '@pkgs/sql-root-shared-ts/sql';
import fc from 'fast-check';
import type { SessionJson } from './email-link-fixture';
import {
  APP_ORIGIN,
  CALLBACK_URL,
  emailLinkFixture,
  FABRICS,
  SECRET,
  UNSERVED_ADDRESS,
} from './email-link-fixture';

const ALICE = 'alice@example.com';

describe('email link boundaries', () => {
  test.each(FABRICS)('a link signs in exactly once (%s)', async (fabric) => {
    const fixture = await emailLinkFixture({ fabric });
    try {
      const token = await fixture.mailedToken(ALICE);
      const first = await fixture.post('email/confirm', { token });
      expect(first.status).toBe(200);
      const session = (await first.json()) as SessionJson;
      expect(session.user.email).toBe(ALICE);
      expect(first.headers.get('set-auth-token')).toBe(session.token);
      const again = await fixture.post('email/confirm', { token }, 1);
      expect(again.status).toBe(401);
      expect(await again.json()).toEqual({ error: 'expired' });
    } finally {
      await fixture.db.disconnect();
    }
  });

  test.each(FABRICS)(
    'two confirms racing on one link cannot both succeed (%s)',
    async (fabric) => {
      const fixture = await emailLinkFixture({ fabric });
      try {
        const token = await fixture.mailedToken(ALICE);
        const answers = await Promise.all([
          fixture.post('email/confirm', { token }, 0),
          fixture.post('email/confirm', { token }, 1),
        ]);
        expect(answers.map((res) => res.status).sort()).toEqual([200, 401]);
        expect(
          await fixture.db.query(
            sql<{ id: string }>`SELECT id FROM idp_sessions`
          )
        ).toHaveLength(1);
      } finally {
        await fixture.db.disconnect();
      }
    }
  );

  test('a link lapses ten minutes after it was mailed', async () => {
    const fixture = await emailLinkFixture();
    try {
      expect(AUTH_EMAIL_LINK_TTL_MS).toBe(600_000);
      const live = await fixture.mailedToken(ALICE);
      const mail = fixture.inbox.latest(ALICE);
      expect(mail?.expiresAt).toBe(fixture.clock.now() + 600_000);
      fixture.clock.advance(599_999);
      expect(
        (await fixture.post('email/confirm', { token: live })).status
      ).toBe(200);
      const lapsed = await fixture.mailedToken(ALICE);
      fixture.clock.advance(600_000);
      const late = await fixture.post('email/confirm', { token: lapsed });
      expect(late.status).toBe(401);
      expect(await late.json()).toEqual({ error: 'expired' });
      // A lapsed link was spent by the attempt: it stays refused.
      expect(
        (await fixture.post('email/confirm', { token: lapsed })).status
      ).toBe(401);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('only the hash of a link is stored', async () => {
    const fixture = await emailLinkFixture();
    try {
      const tokens = [
        await fixture.mailedToken(ALICE),
        await fixture.mailedToken('bob@example.com'),
      ];
      expect(new Set(tokens).size).toBe(2);
      const rows = await fixture.db.query(
        sql<{ token_hash: string }>`SELECT * FROM idp_email_links`
      );
      expect(rows.map((row) => row.token_hash).sort()).toEqual(
        tokens.map((token) => hashAuthSecret(SECRET, token)).sort()
      );
      for (const token of tokens) {
        expect(JSON.stringify(rows)).not.toContain(token);
      }
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('a request answers the same for an account, a stranger and an address the host does not serve', async () => {
    const fixture = await emailLinkFixture();
    try {
      await fixture.signIn(ALICE);
      const mailsBefore = fixture.inbox.all().length;
      const answers: { status: number; body: string }[] = [];
      for (const email of [ALICE, 'stranger@example.com', UNSERVED_ADDRESS]) {
        const res = await fixture.post('email/request', {
          email,
          callbackUrl: CALLBACK_URL,
        });
        answers.push({ status: res.status, body: await res.text() });
      }
      expect(answers).toEqual([
        { status: 202, body: '{}' },
        { status: 202, body: '{}' },
        { status: 202, body: '{}' },
      ]);
      // Asking is not signing in: nobody new exists until a link is opened.
      expect(
        await fixture.db.query(sql<{ id: string }>`SELECT id FROM idp_users`)
      ).toHaveLength(1);
      // The unserved address was never mailed, and holds no link to guess.
      expect(fixture.inbox.all()).toHaveLength(mailsBefore + 2);
      expect(fixture.inbox.latest(UNSERVED_ADDRESS)).toBeNull();
      expect(
        await fixture.db.query(
          sql<{
            id: string;
          }>`SELECT id FROM idp_email_links WHERE email = ${UNSERVED_ADDRESS}`
        )
      ).toEqual([]);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test.each(FABRICS)(
    'an address is throttled across replicas and admitted again after its window (%s)',
    async (fabric) => {
      const fixture = await emailLinkFixture({ fabric });
      try {
        for (const email of [ALICE, UNSERVED_ADDRESS]) {
          for (let index = 0; index < 10; index += 1) {
            expect(
              (await fixture.post('email/request', { email }, index % 2)).status
            ).toBe(202);
          }
          // Served or not, the eleventh ask is refused alike.
          expect(
            (await fixture.post('email/request', { email }, 1)).status
          ).toBe(429);
        }
        expect(fixture.inbox.all()).toHaveLength(10);
        // One address being throttled does not throttle another.
        expect(
          (await fixture.post('email/request', { email: 'bob@example.com' }))
            .status
        ).toBe(202);
        fixture.clock.advance(600_000);
        expect(
          (await fixture.post('email/request', { email: ALICE })).status
        ).toBe(202);
      } finally {
        await fixture.db.disconnect();
      }
    }
  );

  test('a malformed address is refused before anything is mailed', async () => {
    const fixture = await emailLinkFixture();
    try {
      await assertProperty(
        'email address admission',
        fc.asyncProperty(
          fc.oneof(
            fc.string({ maxLength: 40 }).filter((text) => !text.includes('@')),
            fc.constantFrom(
              '@example.com',
              'alice@',
              'alice@example',
              'alice smith@example.com',
              `${'a'.repeat(250)}@example.com`
            )
          ),
          async (email) => {
            const res = await fixture.post('email/request', { email });
            expect(res.status).toBe(400);
          }
        )
      );
      expect(fixture.inbox.all()).toEqual([]);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('untrusted origins, untrusted callback URLs and oversized payloads are refused', async () => {
    const fixture = await emailLinkFixture();
    try {
      const attacker = { origin: 'https://attacker.example' };
      expect(
        (await fixture.post('email/request', { email: ALICE }, 0, attacker))
          .status
      ).toBe(400);
      expect(
        (
          await fixture.post('email/request', {
            email: ALICE,
            callbackUrl: 'https://attacker.example/sso-callback',
          })
        ).status
      ).toBe(400);
      expect(
        (
          await fixture.post('email/request', {
            email: ALICE,
            callbackUrl: `${'x'.repeat(5000)}`,
          })
        ).status
      ).toBe(413);
      expect(fixture.inbox.all()).toEqual([]);
      const token = await fixture.mailedToken(ALICE);
      expect(
        (await fixture.post('email/confirm', { token }, 0, attacker)).status
      ).toBe(400);
      // The refused confirm did not spend the link.
      expect(
        (
          await fixture.post('email/confirm', { token }, 0, {
            origin: APP_ORIGIN,
          })
        ).status
      ).toBe(200);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('a token nobody was mailed signs nobody in', async () => {
    const fixture = await emailLinkFixture();
    try {
      await fixture.mailedToken(ALICE);
      await assertProperty(
        'unknown link tokens',
        fc.asyncProperty(
          fc.oneof(fc.string({ maxLength: 300 }), fc.uuid()),
          async (token) => {
            const res = await fixture.post('email/confirm', { token });
            expect(res.status).toBe(401);
          }
        )
      );
      expect(
        (await fixture.post('email/confirm', { nonsense: true })).status
      ).toBe(401);
      expect(
        await fixture.db.query(sql<{ id: string }>`SELECT id FROM idp_users`)
      ).toEqual([]);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test("the link opens the caller's callback URL; without one it is the bare token", async () => {
    const fixture = await emailLinkFixture();
    try {
      await fixture.mailedToken(' Alice@Example.COM ', {
        callbackUrl: `${CALLBACK_URL}?from=mail`,
      });
      const mail = fixture.inbox.latest(ALICE);
      expect(mail?.email).toBe(ALICE);
      const link = new URL(mail?.link ?? '');
      expect(`${link.origin}${link.pathname}`).toBe(CALLBACK_URL);
      expect(link.searchParams.get('from')).toBe('mail');
      expect(link.searchParams.get('email_link')).toBe(mail?.token ?? null);
      const bare = await fixture.mailedToken(ALICE);
      expect(fixture.inbox.latest(ALICE)?.link).toBe(bare);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('a mail service that fails to send fails the request, and signs nobody in', async () => {
    const fixture = await emailLinkFixture({ mailDown: true });
    try {
      const asked = await fixture.post('email/request', { email: ALICE });
      expect(asked.status).toBe(500);
      expect(
        await fixture.db.query(sql<{ id: string }>`SELECT id FROM idp_users`)
      ).toEqual([]);
      // An address the host does not serve was never going to be mailed.
      expect(
        (await fixture.post('email/request', { email: UNSERVED_ADDRESS }))
          .status
      ).toBe(202);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('a host with no email sign-in answers 404', async () => {
    const fixture = await emailLinkFixture({ emailSignIn: false });
    try {
      expect(
        (await fixture.post('email/request', { email: ALICE })).status
      ).toBe(404);
      expect(
        (await fixture.post('email/confirm', { token: 'anything' })).status
      ).toBe(404);
    } finally {
      await fixture.db.disconnect();
    }
  });
});
