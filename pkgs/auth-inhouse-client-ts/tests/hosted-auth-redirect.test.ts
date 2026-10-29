import { afterEach, expect, test } from 'bun:test';
import { createInhouseAuthClient } from '@pkgs/auth-inhouse-client-ts/create-inhouse-auth-client';
import { createBearerTokenStore } from '@pkgs/auth-inhouse-shared-ts/bearer-token-store';
import { AuthFlowError } from '@pkgs/auth-root-client-ts/auth-flow-error';
import { AuthLinkRequiredError } from '@pkgs/auth-root-client-ts/auth-link-required-error';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';

const locationDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'location'
);
const CALLBACK = 'https://app.test/sso-callback';

afterEach(() => {
  if (locationDescriptor !== undefined) {
    Object.defineProperty(globalThis, 'location', locationDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'location');
  }
});

function setCallback(search: string): void {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { href: `${CALLBACK}${search}` },
  });
}

// regression: social-auth-redirect-outcome
test.each([
  ['?error=provider_failed', AuthFlowError],
  ['?error=cancelled', Error],
  [
    '?link_required=pending-token&link_provider=apple&link_email=person%40example.com&link_providers=google',
    AuthLinkRequiredError,
  ],
] as const)(
  'the callback publishes %s to the resumed sign-in modal',
  async (search, errorType) => {
    setCallback(search);
    const port = createInhouseAuthClient({
      baseURL: 'https://api.test',
      callbackUrl: CALLBACK,
      ...createHarnessClock(),
      fetch: async () => {
        throw new Error('A failed callback must not exchange a session');
      },
      bearerStore: createBearerTokenStore({ storageKey: 'myapp.auth.bearer' }),
    });
    await expect(port.completeHostedAuthRedirect?.()).rejects.toBeInstanceOf(
      errorType
    );
    expect(port.session.getSnapshot().error).toBeInstanceOf(errorType);
    expect(port.session.getSnapshot().isHydrated).toBe(true);
    expect(port.session.getSnapshot().session).toBeNull();
  }
);

test.each([null, 'previous-bearer'])(
  'the returned code replaces %s before sign-in completes',
  async (previous) => {
    setCallback('?code=one-time-code');
    const requests: { url: string; init: RequestInit | undefined }[] = [];
    const bearerStore = createBearerTokenStore({
      storageKey: 'myapp.auth.bearer',
    });
    if (previous !== null) await bearerStore.write(previous);
    const port = createInhouseAuthClient({
      baseURL: 'https://api.test',
      callbackUrl: CALLBACK,
      ...createHarnessClock(),
      bearerStore,
      fetch: async (input, init) => {
        requests.push({ url: String(input), init });
        return Response.json({
          token: 'new-bearer',
          user: { id: 'person', email: 'person@example.com' },
          expiresAt: '2030-01-01T00:00:00.000Z',
        });
      },
    });
    await port.completeHostedAuthRedirect?.();
    expect(requests[0]?.url).toBe('https://api.test/api/auth/session');
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      code: 'one-time-code',
    });
    expect(requests[1]?.init?.headers).toEqual({
      authorization: 'Bearer new-bearer',
    });
    expect(await port.getFreshToken()).toBe('new-bearer');
    expect(port.session.getSnapshot().error).toBeNull();
    expect(port.session.getSnapshot().session?.externalUserId).toBe('person');
    if (previous === null) expect(requests).toHaveLength(2);
    else {
      expect(requests).toHaveLength(3);
      expect(requests[2]?.url).toBe('https://api.test/api/auth/sign-out');
      expect(requests[2]?.init?.headers).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer previous-bearer',
      });
    }
  }
);

test.each([null, 'previous-bearer'])(
  'an opened email link replaces %s with the session it yields',
  async (previous) => {
    setCallback('?email_link=one-time-token');
    const requests: { url: string; init: RequestInit | undefined }[] = [];
    const bearerStore = createBearerTokenStore({
      storageKey: 'myapp.auth.bearer',
    });
    if (previous !== null) await bearerStore.write(previous);
    const port = createInhouseAuthClient({
      baseURL: 'https://api.test',
      callbackUrl: CALLBACK,
      ...createHarnessClock(),
      bearerStore,
      fetch: async (input, init) => {
        requests.push({ url: String(input), init });
        return Response.json({
          token: 'new-bearer',
          user: { id: 'person', email: 'person@example.com' },
          expiresAt: '2030-01-01T00:00:00.000Z',
        });
      },
    });
    await port.completeHostedAuthRedirect?.();
    expect(requests[0]?.url).toBe('https://api.test/api/auth/email/confirm');
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({
      token: 'one-time-token',
    });
    expect(await port.getFreshToken()).toBe('new-bearer');
    expect(port.session.getSnapshot().session?.externalUserId).toBe('person');
    if (previous === null) expect(requests).toHaveLength(2);
    else {
      expect(requests).toHaveLength(3);
      expect(requests[2]?.url).toBe('https://api.test/api/auth/sign-out');
      expect(requests[2]?.init?.headers).toEqual({
        'content-type': 'application/json',
        authorization: 'Bearer previous-bearer',
      });
    }
  }
);

test('an email link that no longer works is published to the sign-in modal', async () => {
  setCallback('?email_link=spent-token');
  const port = createInhouseAuthClient({
    baseURL: 'https://api.test',
    callbackUrl: CALLBACK,
    ...createHarnessClock(),
    fetch: async () => Response.json({ error: 'expired' }, { status: 401 }),
    bearerStore: createBearerTokenStore({ storageKey: 'myapp.auth.bearer' }),
  });
  await expect(port.completeHostedAuthRedirect?.()).rejects.toMatchObject({
    code: 'expired',
  });
  expect(port.session.getSnapshot().error).toBeInstanceOf(AuthFlowError);
  expect(port.session.getSnapshot().session).toBeNull();
});
