import { describe, expect, test } from 'bun:test';
import { WorkerState } from '@libs/infra/public/worker-state';
import type { HttpClient } from '@pkgs/http-client';

const namespace = {
  id: 'room-storage',
  script: 'app-dev',
  class: 'RoomServerDurableObject',
};
const reply = (result: unknown): Response =>
  Response.json({ success: true, result });

describe('Cloudflare Worker inventory', () => {
  test('reads every namespace page through the injected HTTP port', async () => {
    const requests: string[] = [];
    const http: HttpClient = {
      fetch: async (input, init) => {
        const url = String(input);
        requests.push(url);
        expect(new Headers(init?.headers).get('Authorization')).toBe(
          'Bearer test-token'
        );
        return reply(
          url.includes('page=1&')
            ? Array.from({ length: 100 }, (_, index) => ({
                ...namespace,
                id: String(index),
              }))
            : [namespace]
        );
      },
    };
    const state = new WorkerState(http, 'test-account', 'test-token');
    const all = await state.namespaces();
    expect(all).toHaveLength(101);
    expect(all[100]).toEqual(namespace);
    expect(requests).toEqual(
      [1, 2].map(
        (page) =>
          `https://api.cloudflare.com/client/v4/accounts/test-account/workers/durable_objects/namespaces?page=${String(page)}&per_page=100`
      )
    );
  });

  test('reads domains and the exact bound room namespace', async () => {
    const state = new WorkerState(
      {
        fetch: async (input) => {
          return reply(
            String(input).endsWith('/settings')
              ? {
                  bindings: [
                    {
                      name: 'ROOM',
                      type: 'durable_object_namespace',
                      namespace_id: namespace.id,
                    },
                  ],
                }
              : [{ hostname: 'app.example.test', service: namespace.script }]
          );
        },
      },
      'account',
      'token'
    );
    expect(await state.domains()).toEqual([
      { hostname: 'app.example.test', service: namespace.script },
    ]);
    expect(await state.roomNamespaceId(namespace.script)).toBe(namespace.id);
  });

  test('failed, malformed or incomplete inventory never looks like an empty account', async () => {
    for (const response of [
      new Response('unavailable', { status: 503 }),
      Response.json({ success: false, result: [] }),
      reply([{ id: 'unowned-storage' }]),
    ]) {
      const state = new WorkerState(
        { fetch: async () => response },
        'account',
        'token'
      );
      await expect(state.namespaces()).rejects.toThrow();
    }
    const state = new WorkerState(
      { fetch: async () => reply({ bindings: [] }) },
      'account',
      'token'
    );
    await expect(state.roomNamespaceId('app')).rejects.toThrow(
      'ROOM binding is missing'
    );
  });
});
