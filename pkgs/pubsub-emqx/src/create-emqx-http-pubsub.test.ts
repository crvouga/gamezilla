import { describe, expect, mock, test } from 'bun:test';
import {
  PubSubNotSupportedError,
  PubSubPublishError,
} from '@pkgs/pubsub/interface';
import { createEmqxHttpPubSub } from './create-emqx-http-pubsub';

describe('createEmqxHttpPubSub', () => {
  test('publish posts qos1 retain false with basic auth', async () => {
    const fetchImpl = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe('http://emqx:18083/api/v5/publish');
        expect(init?.method).toBe('POST');
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe(
          `Basic ${btoa('key:secret')}`
        );
        expect(JSON.parse(String(init?.body))).toEqual({
          topic: 'user:1',
          payload: JSON.stringify({ a: 1 }),
          qos: 1,
          retain: false,
        });
        return new Response(null, { status: 200 });
      }
    );

    const ps = createEmqxHttpPubSub({
      apiBaseUrl: 'http://emqx:18083/',
      apiKey: 'key',
      apiSecret: 'secret',
      fetchImpl,
    });
    await ps.publish('user:1', { a: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    ps.close();
  });

  test('non-2xx throws PubSubPublishError', async () => {
    const ps = createEmqxHttpPubSub({
      apiBaseUrl: 'http://emqx:18083',
      apiKey: 'k',
      apiSecret: 's',
      fetchImpl: async () => new Response('nope', { status: 401 }),
    });
    await expect(ps.publish('t', 1)).rejects.toBeInstanceOf(PubSubPublishError);
  });

  test('subscribe throws not supported', () => {
    const ps = createEmqxHttpPubSub({
      apiBaseUrl: 'http://x',
      apiKey: 'k',
      apiSecret: 's',
      fetchImpl: async () => new Response(),
    });
    expect(() => ps.subscribe('t', () => undefined)).toThrow(
      PubSubNotSupportedError
    );
    expect(ps.status()).toBe('connected');
  });

  test('rejects invalid topic and oversized payload', async () => {
    const fetchImpl = mock(async () => new Response(null, { status: 200 }));
    const ps = createEmqxHttpPubSub({
      apiBaseUrl: 'http://x',
      apiKey: 'k',
      apiSecret: 's',
      fetchImpl,
    });
    await expect(ps.publish('a/b', 1)).rejects.toThrow();
    await expect(ps.publish('t', 'x'.repeat(33 * 1024))).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('close is terminal', async () => {
    const ps = createEmqxHttpPubSub({
      apiBaseUrl: 'http://x',
      apiKey: 'k',
      apiSecret: 's',
      fetchImpl: async () => new Response(null, { status: 200 }),
    });
    ps.close();
    expect(ps.status()).toBe('down');
    await expect(ps.publish('t', 1)).rejects.toThrow();
  });
});
