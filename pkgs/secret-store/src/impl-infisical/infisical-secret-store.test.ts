import { describe, expect, it } from 'bun:test';
import { SecretStoreRequestError } from '../errors';
import { InfisicalSecretStore } from './infisical-secret-store';

type RecordedCall = {
  readonly method: string;
  readonly url: string;
  readonly body: string | null;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type InfisicalFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function createRecordingFetch(
  handler: (call: RecordedCall) => Response
): { fetchFn: InfisicalFetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchFn: InfisicalFetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    const url = String(input);
    const body =
      typeof init?.body === 'string'
        ? init.body
        : init?.body === undefined || init.body === null
          ? null
          : String(init.body);
    const call: RecordedCall = { method, url, body };
    calls.push(call);
    return handler(call);
  };
  return { fetchFn, calls };
}

function createStore(fetchFn: InfisicalFetch): InfisicalSecretStore {
  return new InfisicalSecretStore({
    domain: 'https://app.infisical.com',
    workspaceId: 'ws-1',
    env: 'prd',
    token: 'tok',
    secretPath: '/',
    fetchFn,
  });
}

describe('InfisicalSecretStore.setSecret', () => {
  it('POSTs to create when the secret does not exist', async () => {
    const { fetchFn, calls } = createRecordingFetch(() =>
      jsonResponse(200, { secret: { secretKey: 'STRIPE_WEBHOOK_SECRET' } })
    );
    const store = createStore(fetchFn);

    await store.setSecret('STRIPE_WEBHOOK_SECRET', 'whsec_new');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toContain('/api/v3/secrets/raw/STRIPE_WEBHOOK_SECRET');
    expect(JSON.parse(calls[0]?.body ?? '{}')).toMatchObject({
      workspaceId: 'ws-1',
      environment: 'prd',
      secretPath: '/',
      secretValue: 'whsec_new',
      type: 'shared',
    });
  });

  it('PATCHes when POST returns 400 Secret already exist', async () => {
    const { fetchFn, calls } = createRecordingFetch((call) => {
      if (call.method === 'POST') {
        return textResponse(
          400,
          JSON.stringify({
            statusCode: 400,
            message: 'Secret already exist',
            error: 'BadRequest',
          })
        );
      }
      return jsonResponse(200, { secret: { secretKey: 'STRIPE_WEBHOOK_SECRET' } });
    });
    const store = createStore(fetchFn);

    await store.setSecret('STRIPE_WEBHOOK_SECRET', 'whsec_rotated');

    expect(calls.map((c) => c.method)).toEqual(['POST', 'PATCH']);
    expect(JSON.parse(calls[1]?.body ?? '{}')).toMatchObject({
      secretValue: 'whsec_rotated',
    });
  });

  it('PATCHes when POST returns 409', async () => {
    const { fetchFn, calls } = createRecordingFetch((call) => {
      if (call.method === 'POST') {
        return textResponse(409, 'Conflict');
      }
      return jsonResponse(200, {});
    });
    const store = createStore(fetchFn);

    await store.setSecret('FOO', 'bar');

    expect(calls.map((c) => c.method)).toEqual(['POST', 'PATCH']);
  });

  it('throws on non-exists POST 400 without attempting PATCH', async () => {
    const { fetchFn, calls } = createRecordingFetch(() =>
      textResponse(
        400,
        JSON.stringify({
          statusCode: 400,
          message: 'Invalid secret path',
          error: 'BadRequest',
        })
      )
    );
    const store = createStore(fetchFn);

    await expect(store.setSecret('FOO', 'bar')).rejects.toBeInstanceOf(
      SecretStoreRequestError
    );
    expect(calls.map((c) => c.method)).toEqual(['POST']);
  });

  it('throws when PATCH after already-exists fails', async () => {
    const { fetchFn } = createRecordingFetch((call) => {
      if (call.method === 'POST') {
        return textResponse(
          400,
          JSON.stringify({ message: 'Secret already exist' })
        );
      }
      return textResponse(403, JSON.stringify({ message: 'Forbidden' }));
    });
    const store = createStore(fetchFn);

    await expect(store.setSecret('FOO', 'bar')).rejects.toThrow(
      /Infisical setSecret failed: HTTP 403/
    );
  });
});
