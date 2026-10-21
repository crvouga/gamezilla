import { expect, test } from 'bun:test';
import { LOCAL_ADMIN_ACCOUNTS } from '@apps/product-ts/scripts/local-admin-accounts';
import { LocalAdminSeeder } from '@apps/product-ts/scripts/local-admin-seeder';
import { EnsureInternalAccountUseCase } from '@libs/auth-shared-ts/ensure-internal-account-use-case';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { permissionPolicyForPuzzleManagers } from '@libs/permissions-shared-ts/permission-policy';
import { HARNESS_AUTH_SECRET } from '@libs/sub-shared-ts/harness-constants';
import { createAuthServerAdapter } from '@pkgs/auth-inhouse-server-ts/create-auth-server-adapter';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { decide } from '@pkgs/permissions-shared-ts/decision';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';
import { localAdminFixture } from './local-admin-fixture';

// regression: local-oauth-missing-admin-accounts
test.each(['google', 'apple'] as const)(
  'local admin %s sign-ins resolve to the seeded puzzle managers across restarts',
  async (provider) => {
    const { db, ports, signIn, identities } = await localAdminFixture();
    try {
      const auth = createAuthServerAdapter({
        getSql: () => db,
        ...ports,
        secret: HARNESS_AUTH_SECRET,
      });
      const ensure = new EnsureInternalAccountUseCase(db, ports, auth);
      // A kept database may already contain an account signed in before seeding.
      const first = await signIn('admin@gmail.com');
      const existingId = await ensure.execute({
        externalUserId: first.user.id,
      });
      const seeder = new LocalAdminSeeder(ports, identities);
      await seeder.seed({ sqlClient: db, logger: createNoopLogger() });
      const originalIds = [...seeder.accountIds];
      expect(originalIds).toHaveLength(2);
      expect(originalIds).toContain(existingId);
      await seeder.seed({ sqlClient: db, logger: createNoopLogger() });
      expect(seeder.accountIds).toEqual(originalIds);
      const policy = permissionPolicyForPuzzleManagers(seeder.accountIds);
      for (const email of [
        ...LOCAL_ADMIN_ACCOUNTS.map((a) => a.email),
        'alice@gmail.com',
      ]) {
        const session = await signIn(email, provider);
        const verified = await auth.verifySessionToken(session.token);
        expect(verified?.externalUserId).toBe(session.user.id);
        const accountId = await ensure.execute({
          externalUserId: session.user.id,
        });
        const allowed = originalIds.includes(accountId);
        expect(allowed).toBe(email !== 'alice@gmail.com');
        const subject = resolveSubject(policy, {
          auth: 'verified',
          accountId,
          membership: 'none',
          subscription: 'none',
          billing: 'off',
        });
        expect(decide(policy, subject, PERMISSION.puzzlesManage).allowed).toBe(
          allowed
        );
        if (allowed) {
          const user = await auth.getUser(session.user.id);
          expect(
            user?.identities?.map((identity) => identity.provider).sort()
          ).toEqual(['apple', 'google']);
        }
      }
    } finally {
      await db.disconnect();
    }
  }
);
