import { expect, test } from 'bun:test';
import { logOutThroughUi } from '@libs/synthetic-population-shared-ts/application-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

test('sign-out waits for the dismissed success surface to release the screen', async () => {
  // regression: sign-out-dismissal-still-covers-screen
  const waiting = Promise.withResolvers<void>();
  const closing = Promise.withResolvers<void>();
  let signedOut = false;
  let dismissed = false;
  let modalVisible = true;
  const driver = {
    get: (id: string) => ({
      isVisible: async () =>
        id === Handles.authSignOutModal
          ? modalVisible
          : id === Handles.accountSignIn && signedOut,
      tap: async () => {
        if (id === Handles.authSignOutConfirm) signedOut = true;
        if (id === Handles.authSignOutDone) dismissed = true;
      },
      wait: async (state: string) => {
        if (id !== Handles.authSignOutModal || state !== 'hidden') return;
        expect(dismissed).toBe(true);
        waiting.resolve();
        await closing.promise;
        modalVisible = false;
      },
    }),
  } as unknown as Driver;
  const operation = logOutThroughUi(driver);
  try {
    expect(
      await Promise.race([
        waiting.promise.then(() => 'waiting'),
        operation.then(() => 'returned'),
      ])
    ).toBe('waiting');
    expect(modalVisible).toBe(true);
  } finally {
    closing.resolve();
    await operation;
  }
  expect(modalVisible).toBe(false);
});
