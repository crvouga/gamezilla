import { expect, test } from 'bun:test';
import {
  BUG_REPORT_ACCOUNT_CONTEXT,
  useBugReportAccount,
} from '@libs/auth-client-ts/bug-report-account';
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import { feedbackContextProviders } from '@pkgs/feedback-shared-ts/context';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage-root-client-ts/solid';
import { createInMemorySecureStorage } from '@pkgs/secure-storage-root-shared-ts/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';
import { render } from '@solidjs/testing-library';

const ALICE = '22222222-2222-4222-8222-222222222222';

/** What a bug report sent now would say of the account, with this on the device. */
async function named(stored: Record<string, string>): Promise<unknown> {
  const store = createSecureStorageStore(createInMemorySecureStorage());
  for (const [key, value] of Object.entries(stored))
    await store.write(key, value);
  await store.hydrate(SESSION_TOKEN_KEY);
  await store.hydrate(LAST_LOCAL_ACCOUNT_ID_KEY);
  function Probe() {
    useBugReportAccount();
    return null;
  }
  const view = render(() => (
    <SecureStorageStoreProvider value={store}>
      <Probe />
    </SecureStorageStoreProvider>
  ));
  const account = feedbackContextProviders().find(
    (provider) => provider.name === BUG_REPORT_ACCOUNT_CONTEXT
  );
  const value = account?.collect(new AbortController().signal);
  view.unmount();
  return value;
}

test('a signed-in person’s bug report names their account', async () => {
  expect(
    await named({
      [LAST_LOCAL_ACCOUNT_ID_KEY]: ALICE,
      [SESSION_TOKEN_KEY]: 'bearer',
    })
  ).toEqual({ id: ALICE });
});

test('a guest’s bug report names no account, though their app has an id', async () => {
  expect(await named({ [LAST_LOCAL_ACCOUNT_ID_KEY]: ALICE })).toEqual({});
});

test('nothing of the account is left once the app is gone', async () => {
  await named({ [LAST_LOCAL_ACCOUNT_ID_KEY]: ALICE });
  expect(
    feedbackContextProviders().some(
      (provider) => provider.name === BUG_REPORT_ACCOUNT_CONTEXT
    )
  ).toBe(false);
});
