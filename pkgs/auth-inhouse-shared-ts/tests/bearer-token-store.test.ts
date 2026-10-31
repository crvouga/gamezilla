import { describe, expect, test } from 'bun:test';
import {
  createBearerTokenStore,
  createInMemoryAuthClientStorage,
} from '@pkgs/auth-inhouse-shared-ts/bearer-token-store';

describe('bearer token store', () => {
  test('persists the token under the key the host chose', async () => {
    const storage = createInMemoryAuthClientStorage();
    const store = createBearerTokenStore({
      storage,
      storageKey: 'myapp.auth.bearer',
    });
    await store.write('token-1');
    expect(storage.getItem('myapp.auth.bearer')).toBe('token-1');

    const reopened = createBearerTokenStore({
      storage,
      storageKey: 'myapp.auth.bearer',
    });
    expect(await reopened.read()).toBe('token-1');

    const otherKey = createBearerTokenStore({
      storage,
      storageKey: 'otherapp.auth.bearer',
    });
    expect(await otherKey.read()).toBeNull();
  });

  test('clearing removes the stored token', async () => {
    const storage = createInMemoryAuthClientStorage();
    const store = createBearerTokenStore({ storage, storageKey: 'k' });
    await store.write('token-1');
    await store.clear();
    expect(storage.getItem('k')).toBeNull();
  });
});
