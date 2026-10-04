/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import type { SecureStorage } from '@pkgs/secure-storage-shared/interface';
import { createSecureStorageStore } from '@pkgs/secure-storage-shared/secure-storage-store';
import { createSecureStorageItem, SecureStorageStoreProvider } from '@pkgs/secure-storage-client/solid';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { type JSX, untrack } from 'solid-js';

function createMemoryStorage(
  initial: Record<string, string> = {}
): SecureStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => Promise.resolve(map.get(key) ?? null),
    setItem: (key, value) => {
      map.set(key, value);
      return Promise.resolve();
    },
    deleteItem: (key) => {
      map.delete(key);
      return Promise.resolve();
    },
  };
}

function Item(props: { readonly storageKey: string }): JSX.Element {
  // The key is fixed for the component's lifetime (mirrors useSecureStorageItem).
  const item = createSecureStorageItem(untrack(() => props.storageKey));
  return (
    <output>
      {item.isHydrated() ? 'hydrated' : 'loading'}:{item.value() ?? 'null'}
      <button type="button" onClick={() => void item.setValue('written')}>
        write
      </button>
    </output>
  );
}

describe('createSecureStorageItem', () => {
  test('hydrates from storage then reflects writes', async () => {
    const store = createSecureStorageStore(createMemoryStorage({ k: 'v1' }));
    render(() => (
      <SecureStorageStoreProvider value={store}>
        <Item storageKey="k" />
      </SecureStorageStoreProvider>
    ));
    const output = screen.getByRole('status');
    expect(output).toHaveTextContent('loading:null');
    await waitFor(() => expect(output).toHaveTextContent('hydrated:v1'));
    screen.getByRole('button').click();
    await waitFor(() => expect(output).toHaveTextContent('hydrated:written'));
    expect(await store.storage.getItem('k')).toBe('written');
  });

  test('treats a failed read as absent', async () => {
    const failing: SecureStorage = {
      getItem: () => Promise.reject(new Error('keychain locked')),
      setItem: () => Promise.resolve(),
      deleteItem: () => Promise.resolve(),
    };
    const store = createSecureStorageStore(failing);
    render(() => (
      <SecureStorageStoreProvider value={store}>
        <Item storageKey="k" />
      </SecureStorageStoreProvider>
    ));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('hydrated:null')
    );
  });
});
