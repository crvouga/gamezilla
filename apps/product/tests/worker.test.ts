import { describe, expect, test } from 'bun:test';
import worker, {
  type AppWorkerEnv,
  RoomServerDurableObject,
  RoomStorageArchive,
} from '@apps/product/worker';

const context = {
  waitUntil: (_promise: Promise<unknown>) => undefined,
  passThroughOnException: () => undefined,
};

describe('application Worker dispatch', () => {
  // regression: deploy-dev-duplicate-room-namespaces
  test('retained room storage rejects requests and finishes alarms without accessing storage', () => {
    const archive = new RoomStorageArchive();
    expect(archive.fetch().status).toBe(410);
    expect(archive.alarm()).toBeUndefined();
  });
  test('forwards client routes and missing assets to the asset binding', async () => {
    const forwarded: Request[] = [];
    const response = new Response('asset', {
      headers: { 'Cross-Origin-Opener-Policy': 'same-origin' },
    });
    const env: AppWorkerEnv = {
      ASSETS: {
        fetch: async (request) => {
          forwarded.push(request);
          return response;
        },
      },
    };
    for (const path of [
      '/',
      '/space/example',
      '/harness',
      '/assets/missing.js',
      '/apiculture',
    ]) {
      const request = new Request(`https://app.example.test${path}`);
      expect(await worker.fetch(request, env, context)).toBe(response);
      expect(forwarded.at(-1)).toBe(request);
    }
  });

  test('API navigation reaches the API handler instead of the SPA fallback', async () => {
    const env: AppWorkerEnv = {
      ASSETS: {
        fetch: async () => {
          throw new Error('API request reached the SPA');
        },
      },
    };
    const response = await worker.fetch(
      new Request('https://app.example.test/api/feedback', {
        headers: { 'Sec-Fetch-Mode': 'navigate' },
      }),
      env,
      context
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Feedback storage unavailable; keep your emergency copy',
    });
  });

  test('exports the room class and scheduled handler in the application entrypoint', () => {
    expect(typeof RoomServerDurableObject).toBe('function');
    expect(typeof worker.scheduled).toBe('function');
  });
});
