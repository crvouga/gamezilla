import { expect, test } from 'bun:test';
import {
  appAuth,
  buildAppAuthContext,
  syncActorOf,
} from '@libs/auth-shared-ts/auth-context';

test('trusted synthetic provenance survives the auth-to-replay boundary without assuming missing facts', () => {
  for (const synthetic of [true, false, undefined]) {
    const ctx = buildAppAuthContext({
      deviceId: 'device-1',
      accountId: 'account-1',
      myId: 'account-1',
      ...(synthetic === undefined ? {} : { synthetic }),
    });
    const auth = appAuth(ctx);
    expect(auth).not.toBeNull();
    expect(auth?.synthetic).toBe(synthetic);
    expect(syncActorOf(auth!).synthetic).toBe(synthetic);
  }
});
