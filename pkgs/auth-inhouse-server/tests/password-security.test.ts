import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import sql from '@pkgs/sql-root-shared/sql';
import fc from 'fast-check';
import { PASSWORD, passwordFixture } from './password-fixture';

describe('password credential boundaries', () => {
  test('rejects invalid lengths before minting any account', async () => {
    const fixture = await passwordFixture();
    try {
      await assertProperty(
        'password length admission',
        fc.asyncProperty(
          fc.oneof(
            fc.string({ maxLength: 14 }),
            fc.string({ minLength: 129, maxLength: 200 })
          ),
          async (password) => {
            expect(
              (
                await fixture.post('password/register', {
                  email: 'alice@example.com',
                  password,
                })
              ).status
            ).toBe(400);
          }
        )
      );
      expect(
        await fixture.db.query(sql<{ id: string }>`SELECT id FROM idp_users`)
      ).toEqual([]);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('hashes credentials with distinct salts and never claims email verification', async () => {
    const fixture = await passwordFixture();
    try {
      for (const email of ['alice@example.com', 'bob@example.com'])
        expect(
          (
            await fixture.post('password/register', {
              email,
              password: PASSWORD,
            })
          ).status
        ).toBe(200);
      const rows = await fixture.db.query(
        sql<{
          salt: string;
          password_hash: string;
        }>`SELECT salt, password_hash FROM idp_passwords`
      );
      expect(rows).toHaveLength(2);
      expect(rows[0]?.salt).not.toBe(rows[1]?.salt);
      expect(rows[0]?.password_hash).not.toBe(rows[1]?.password_hash);
      expect(JSON.stringify(rows)).not.toContain(PASSWORD);
      const identities = await fixture.db.query(
        sql<{
          email_verified: unknown;
        }>`SELECT email_verified FROM idp_accounts`
      );
      expect(
        identities.every(
          (row) => row.email_verified === 0 || row.email_verified === false
        )
      ).toBe(true);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('serializes throttling across replicas and restores admission after its window', async () => {
    const fixture = await passwordFixture();
    try {
      for (let index = 0; index < 10; index += 1)
        expect(
          (
            await fixture.post(
              'password/sign-in',
              { email: 'missing@example.com', password: PASSWORD },
              index % 2
            )
          ).status
        ).toBe(401);
      expect(
        (
          await fixture.post(
            'password/sign-in',
            { email: 'missing@example.com', password: PASSWORD },
            1
          )
        ).status
      ).toBe(429);
      fixture.clock.advance(600_000);
      expect(
        (
          await fixture.post('password/sign-in', {
            email: 'missing@example.com',
            password: PASSWORD,
          })
        ).status
      ).toBe(401);
    } finally {
      await fixture.db.disconnect();
    }
  });

  test('rejects untrusted origins and oversized payloads', async () => {
    const fixture = await passwordFixture();
    try {
      expect(
        (
          await fixture.post(
            'password/register',
            { email: 'alice@example.com', password: PASSWORD },
            0,
            { origin: 'https://attacker.example' }
          )
        ).status
      ).toBe(400);
      expect(
        (
          await fixture.post('password/register', {
            email: 'alice@example.com',
            password: 'x'.repeat(5000),
          })
        ).status
      ).toBe(413);
      expect(
        await fixture.db.query(sql<{ id: string }>`SELECT id FROM idp_users`)
      ).toEqual([]);
    } finally {
      await fixture.db.disconnect();
    }
  });
});
