import { describe, expect, it } from 'bun:test';
import { SecretStoreRequestError } from '@pkgs/secret-store';
import { InfisicalSecretStore } from './http-secret-store';

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

function createRecordingFetch(handler: (call: RecordedCall) => Response): {
  fetchFn: InfisicalFetch;
  calls: RecordedCall[];
} {
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
      jsonResponse(200, { secret: { secretKey: 'EXAMPLE_WEBHOOK_SECRET' } })
    );
    const store = createStore(fetchFn);

    await store.setSecret('EXAMPLE_WEBHOOK_SECRET', 'whsec_new');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toContain(
      '/api/v3/secrets/raw/EXAMPLE_WEBHOOK_SECRET'
    );
    expect(JSON.parse(calls[0]?.body ?? '{}')).toMatchObject({
      workspaceId: 'ws-1',
      environment: 'prd',
      secretPath: '/',
      secretValue: 'whsec_new',
    });
  });

  it('PATCHes when POST reports the secret already exists (409)', async () => {
    const { fetchFn, calls } = createRecordingFetch((call) => {
      if (call.method === 'POST') {
        return textResponse(409, 'Secret already exist');
      }
      return jsonResponse(200, {
        secret: { secretKey: 'EXAMPLE_WEBHOOK_SECRET' },
      });
    });
    const store = createStore(fetchFn);

    await store.setSecret('EXAMPLE_WEBHOOK_SECRET', 'whsec_updated');

    expect(calls.map((c) => c.method)).toEqual(['POST', 'PATCH']);
    expect(JSON.parse(calls[1]?.body ?? '{}')).toMatchObject({
      secretValue: 'whsec_updated',
    });
  });

  it('PATCHes when POST returns 400 already-exist body', async () => {
    const { fetchFn, calls } = createRecordingFetch((call) => {
      if (call.method === 'POST') {
        return textResponse(400, 'Secret already exist');
      }
      return jsonResponse(200, {});
    });
    const store = createStore(fetchFn);

    await store.setSecret('K', 'v');
    expect(calls.map((c) => c.method)).toEqual(['POST', 'PATCH']);
  });

  it('throws SecretStoreRequestError on non-conflict POST failure', async () => {
    const { fetchFn } = createRecordingFetch(() => textResponse(500, 'boom'));
    const store = createStore(fetchFn);

    await expect(store.setSecret('K', 'v')).rejects.toBeInstanceOf(
      SecretStoreRequestError
    );
  });
});
