import { expect, test } from 'bun:test';
import { ensureStackIdpAccounts } from '@libs/harness-ts/stack-idp-accounts';

test('successful setup responses release every transport body', async () => {
  // regression: stack-idp-setup-response-leak
  const previous = globalThis.fetch;
  let released = 0;
  globalThis.fetch = Object.assign(
    async () =>
      new Response(
        new ReadableStream({
          cancel() {
            released++;
          },
        }),
        { status: 201 }
      ),
    { preconnect: previous.preconnect }
  );
  try {
    await ensureStackIdpAccounts({
      idpOrigins: {
        google: 'https://google.example',
        apple: 'https://apple.example',
      },
      actorId: 'alice',
      email: 'alice@friday.example',
    });
    expect(released).toBe(3);
  } finally {
    globalThis.fetch = previous;
  }
});
