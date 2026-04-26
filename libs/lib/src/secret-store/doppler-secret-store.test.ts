import { describe, expect, it } from 'bun:test';
import {
  SecretBlankError,
  SecretMissingError,
  SecretStoreParseError,
  SecretStoreRequestError,
} from './errors';
import { DopplerSecretStore } from './doppler-secret-store';

function mockFetch(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return impl;
}

describe('DopplerSecretStore', () => {
  it('throws when token is blank', () => {
    expect(() => new DopplerSecretStore({ token: '' })).toThrow(
      SecretStoreRequestError
    );
    expect(() => new DopplerSecretStore({ token: '  ' })).toThrow(
      SecretStoreRequestError
    );
  });

  it('getRequired returns trimmed value', async () => {
    const store = new DopplerSecretStore({
      token: 'dp.st.x',
      fetchFn: mockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify({ FOO: '  bar  ' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      ),
    });
    await expect(store.getRequired('FOO')).resolves.toBe('bar');
  });

  it('getRequired throws SecretMissingError when key absent', async () => {
    const store = new DopplerSecretStore({
      token: 't',
      fetchFn: mockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      ),
    });
    await expect(store.getRequired('MISSING')).rejects.toBeInstanceOf(
      SecretMissingError
    );
  });

  it('getRequired throws SecretBlankError when key blank', async () => {
    const store = new DopplerSecretStore({
      token: 't',
      fetchFn: mockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify({ FOO: '  ' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      ),
    });
    await expect(store.getRequired('FOO')).rejects.toBeInstanceOf(
      SecretBlankError
    );
  });

  it('getOptional returns null when absent or blank', async () => {
    const store = new DopplerSecretStore({
      token: 't',
      fetchFn: mockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify({ A: '', B: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      ),
    });
    await expect(store.getOptional('NONE')).resolves.toBeNull();
    await expect(store.getOptional('A')).resolves.toBeNull();
    await expect(store.getOptional('B')).resolves.toBe('ok');
  });

  it('getRequiredMany batches one request', async () => {
    let url = '';
    const store = new DopplerSecretStore({
      token: 'tok',
      fetchFn: mockFetch((input) => {
        url = typeof input === 'string' ? input : input.toString();
        return Promise.resolve(
          new Response(
            JSON.stringify({ A: '1', B: '2' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        );
      }),
    });
    const r = await store.getRequiredMany(['A', 'B']);
    expect(r).toEqual({ A: '1', B: '2' });
    expect(url).toContain('secrets=A%2CB');
  });

  it('throws SecretStoreRequestError on non-OK HTTP', async () => {
    const store = new DopplerSecretStore({
      token: 't',
      fetchFn: mockFetch(() =>
        Promise.resolve(new Response('n', { status: 401 }))
      ),
    });
    await expect(store.getRequired('X')).rejects.toBeInstanceOf(
      SecretStoreRequestError
    );
  });



  it('includes config query when configName is set', async () => {
    let url = '';
    const store = new DopplerSecretStore({
      token: 'tok',
      configName: 'shared',
      fetchFn: mockFetch((input) => {
        url = typeof input === 'string' ? input : input.toString();
        return Promise.resolve(
          new Response(JSON.stringify({ A: '1' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }),
    });

    await expect(store.getRequired('A')).resolves.toBe('1');
    expect(url).toContain('config=shared');
  });

  it('throws SecretStoreParseError on invalid JSON', async () => {
    const store = new DopplerSecretStore({
      token: 't',
      fetchFn: mockFetch(() =>
        Promise.resolve(
          new Response('not-json', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      ),
    });
    await expect(store.getRequired('X')).rejects.toBeInstanceOf(
      SecretStoreParseError
    );
  });
});
