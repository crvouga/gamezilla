import { expect, test } from 'bun:test';
import { logOutThroughUi } from '@libs/synthetic-population-behavior-shared-ts/application-actions';
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
          : (id === Handles.accountSignIn || id === Handles.authSignOutDone) &&
            signedOut,
      tap: async () => {
        if (id === Handles.authSignOutConfirm) signedOut = true;
        if (id === Handles.authSignOutDone) dismissed = true;
      },
      wait: async (state: string, options?: { visibleOr?: string[] }) => {
        if (id !== Handles.authSignOutModal || state !== 'hidden') return;
        if (options?.visibleOr?.includes(Handles.authSignOutDone)) return;
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

test('the signed-out screen can replace the pending confirmation', async () => {
  // regression: sign-out-dialog-replaced-during-submit
  let modalVisible = true;
  const driver = {
    get: (id: string) => ({
      isVisible: async () => id === Handles.authSignOutModal && modalVisible,
      tap: async () => {
        expect(id).not.toBe(Handles.authSignOutDone);
      },
      wait: async (
        state: string,
        options?: { visibleOr?: readonly string[] }
      ) => {
        if (id === Handles.authSignOutModal && modalVisible) {
          expect(state).toBe('hidden');
          expect(options?.visibleOr).toEqual([Handles.authSignOutDone]);
          modalVisible = false;
        }
      },
    }),
  } as unknown as Driver;
  await logOutThroughUi(driver);
  expect(modalVisible).toBe(false);
});

test.each([true, false])(
  'an unavailable Done button is accepted only if the sign-out dialog closed (%s)',
  async (closedDuringTap) => {
    let open = true;
    const failedTap = new Error('The Done button disappeared during the tap');
    const driver = {
      get: (id: string) => ({
        isVisible: () =>
          Promise.resolve(
            id === Handles.authSignOutModal
              ? open
              : id === Handles.authSignOutDone
          ),
        tap: async () => {
          if (id === Handles.authSignOutDone) {
            open = !closedDuringTap;
            throw failedTap;
          }
        },
        wait: async () => {},
      }),
    } as unknown as Driver;
    const operation = logOutThroughUi(driver);
    if (closedDuringTap) await operation;
    else await expect(operation).rejects.toBe(failedTap);
    expect(open).toBe(!closedDuringTap);
  }
);
