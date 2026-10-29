import { describe, expect, test } from 'bun:test';
import { createInhouseAuthClient } from '@pkgs/auth-inhouse-client-ts/create-inhouse-auth-client';
import {
  AUTH_EMAIL_LINK_FAILED_ERROR,
  AUTH_EMAIL_LINK_INVALID_ADDRESS_ERROR,
  AUTH_EMAIL_LINK_THROTTLED_ERROR,
  AUTH_EMAIL_LINK_UNAVAILABLE_ERROR,
} from '@pkgs/auth-inhouse-client-ts/email-link-auth-client';
import { createBearerTokenStore } from '@pkgs/auth-inhouse-shared-ts/bearer-token-store';
import { AuthFlowError } from '@pkgs/auth-root-client-ts/auth-flow-error';
import { AuthLinkRequiredError } from '@pkgs/auth-root-client-ts/auth-link-required-error';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';

const BASE_URL = 'https://api.test';
const CALLBACK = 'https://app.test/sso-callback';
const TOKEN = '0b8f6c1e-link-token';

type Sent = {
  readonly url: string;
  readonly body: unknown;
  readonly authorization: string | null;
};

/** A port whose service answers each request with the next canned response. */
async function portAnswering(
  answers: readonly (() => Response)[],
  previousBearer: string | null = null
) {
  const sent: Sent[] = [];
  const bearerStore = createBearerTokenStore({
    storageKey: 'myapp.auth.bearer',
  });
  if (previousBearer !== null) await bearerStore.write(previousBearer);
  const port = createInhouseAuthClient({
    baseURL: BASE_URL,
    callbackUrl: CALLBACK,
    ...createHarnessClock(),
    bearerStore,
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      sent.push({
        url: String(input),
        body:
          typeof init?.body === 'string'
            ? (JSON.parse(init.body) as unknown)
            : null,
        authorization: headers.get('authorization'),
      });
      const answer = answers[sent.length - 1];
      if (answer === undefined) throw new Error('Unexpected request');
      return answer();
    },
  });
  return { port, sent, bearerStore };
}

const session = (): Response =>
  Response.json({
    token: 'new-bearer',
    user: { id: 'person', email: 'person@example.com', name: null },
    expiresAt: '2030-01-01T00:00:00.000Z',
  });

describe('asking for an emailed sign-in link', () => {
  test('names the address and where the link should open', async () => {
    const { port, sent } = await portAnswering([
      () => Response.json({}, { status: 202 }),
      () => Response.json({}, { status: 202 }),
    ]);
    await port.requestEmailLink('person@example.com');
    await port.requestEmailLink('person@example.com', {
      pendingLink: 'pending-token',
    });
    expect(sent).toEqual([
      {
        url: `${BASE_URL}/api/auth/email/request`,
        body: { email: 'person@example.com', callbackUrl: CALLBACK },
        authorization: null,
      },
      {
        url: `${BASE_URL}/api/auth/email/request`,
        body: {
          email: 'person@example.com',
          callbackUrl: CALLBACK,
          pendingLink: 'pending-token',
        },
        authorization: null,
      },
    ]);
  });

  test.each([
    [400, { error: 'invalid_email' }, AUTH_EMAIL_LINK_INVALID_ADDRESS_ERROR],
    [400, { error: 'invalid_callback_url' }, AUTH_EMAIL_LINK_FAILED_ERROR],
    [429, { error: 'try_later' }, AUTH_EMAIL_LINK_THROTTLED_ERROR],
    [404, { error: 'not_found' }, AUTH_EMAIL_LINK_UNAVAILABLE_ERROR],
    [500, null, AUTH_EMAIL_LINK_FAILED_ERROR],
  ] as const)('a %i refusal is explained', async (status, body, message) => {
    const { port } = await portAnswering([
      () => Response.json(body, { status }),
    ]);
    await expect(port.requestEmailLink('person@example.com')).rejects.toThrow(
      message
    );
  });

  test('a pending link that lapsed is reported as expired', async () => {
    const { port } = await portAnswering([
      () => Response.json({ error: 'expired' }, { status: 409 }),
    ]);
    const asked = port.requestEmailLink('person@example.com', {
      pendingLink: 'gone',
    });
    await expect(asked).rejects.toBeInstanceOf(AuthFlowError);
    await expect(asked).rejects.toMatchObject({ code: 'expired' });
  });
});

describe('signing in from an emailed link', () => {
  test.each([
    ['the whole link', `${CALLBACK}?email_link=${TOKEN}`],
    [
      'a link with other parameters',
      `${CALLBACK}?from=mail&email_link=${TOKEN}`,
    ],
    ['a native link', `myapp://sso-callback?email_link=${TOKEN}`],
    ['the bare token', TOKEN],
    ['a pasted token with stray spaces', `  ${TOKEN}\n`],
  ])('%s is accepted', async (_name, link) => {
    const { port, sent } = await portAnswering([
      session,
      () => Response.json({ user: { id: 'person', email: null, name: null } }),
    ]);
    await port.signInWithEmailLink(link);
    expect(sent[0]).toEqual({
      url: `${BASE_URL}/api/auth/email/confirm`,
      body: { token: TOKEN },
      authorization: null,
    });
    expect(await port.getFreshToken()).toBe('new-bearer');
    expect(port.session.getSnapshot().session?.externalUserId).toBe('person');
  });

  test('the session it replaces is retired', async () => {
    const { port, sent } = await portAnswering(
      [
        session,
        () =>
          Response.json({ user: { id: 'person', email: null, name: null } }),
        () => Response.json({ ok: true }),
      ],
      'previous-bearer'
    );
    await port.signInWithEmailLink(TOKEN);
    expect(sent).toHaveLength(3);
    expect(sent[2]).toEqual({
      url: `${BASE_URL}/api/auth/sign-out`,
      body: {},
      authorization: 'Bearer previous-bearer',
    });
    expect(await port.getFreshToken()).toBe('new-bearer');
  });

  test('a spent or lapsed link is refused and the device keeps its session', async () => {
    const { port, sent } = await portAnswering(
      [() => Response.json({ error: 'expired' }, { status: 401 })],
      'previous-bearer'
    );
    const opened = port.signInWithEmailLink(TOKEN);
    await expect(opened).rejects.toBeInstanceOf(AuthFlowError);
    await expect(opened).rejects.toMatchObject({ code: 'expired' });
    expect(sent).toHaveLength(1);
    expect(await port.getFreshToken()).toBe('previous-bearer');
  });

  test('an address that matched another account asks to connect them', async () => {
    const { port } = await portAnswering([
      () =>
        Response.json(
          {
            link_required: 'pending-token',
            link_provider: 'email',
            link_providers: 'google,email,unknown',
            link_email: 'p•••n@example.com',
          },
          { status: 409 }
        ),
    ]);
    const opened = port.signInWithEmailLink(TOKEN);
    await expect(opened).rejects.toBeInstanceOf(AuthLinkRequiredError);
    await expect(opened).rejects.toMatchObject({
      token: 'pending-token',
      provider: 'email',
      providers: ['google', 'email'],
      email: 'p•••n@example.com',
    });
  });
});
