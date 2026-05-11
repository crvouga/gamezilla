import type { PatchDb } from '@gamezilla/patch-db/interface';
import { describe, expect, it } from 'bun:test';
import { buildAppAuthContextFromBearer } from './bearer-resolve';
import { AccountProvisioningUnexpectedAdapter } from './testing-account-provisioning-unexpected-adapter';
import { SessionClaimsNullAdapter } from './testing-session-claims-null-adapter';

const DEVICE = '550e8400-e29b-41d4-a716-446655440001';

describe('buildAppAuthContextFromBearer', () => {
  it('returns null when bearer verification fails', async () => {
    const db = {
      read: async () => [],
      write: async () => ({ accepted: [], rejected: [] }),
    } as unknown as PatchDb;

    const ctx = await buildAppAuthContextFromBearer({
      db,
      bearerAuth: {
        sessionClaims: new SessionClaimsNullAdapter(),
        accountProvisioning: new AccountProvisioningUnexpectedAdapter(),
      },
      bearerToken: 'bad',
      deviceId: DEVICE,
      loadMemberOfSpaceIds: async () => [],
    });
    expect(ctx).toBeNull();
  });
});
