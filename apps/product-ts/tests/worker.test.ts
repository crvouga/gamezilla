import { describe, expect, test } from 'bun:test';
import type { AppWorkerEnv } from '@apps/product-ts/worker';
import worker, {
  RoomServerDurableObject,
  RoomStorageArchive,
} from '@apps/product-ts/worker';
import { createServer as createGitHubServer } from '@crvouga/mockingbird-service-github/server';

import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  startS3Server,
} from '@pkgs/s3-server-ts/s3-server';

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
      new Request('https://app.example.test/api/bug-reports', {
        headers: { 'Sec-Fetch-Mode': 'navigate' },
      }),
      env,
      context
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Bug reports cannot be received right now',
      reason: 'storage is unavailable',
    });
  });

  test('a bug report sent to the Worker is a labelled GitHub issue with its screenshot kept', async () => {
    const gitHub = await createGitHubServer();
    const s3 = await startS3Server();
    try {
      await fetch(`${gitHub.url}/__admin/github/repositories`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner: 'team', name: 'app' }),
      });
      const env: AppWorkerEnv = {
        ASSETS: {
          fetch: async () => {
            throw new Error('API request reached the SPA');
          },
        },
        S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY,
        S3_BUCKET,
        S3_REGION,
        S3_ENDPOINT: s3.endpoint,
        FEEDBACK_GITHUB_TOKEN: 'secret-token',
        FEEDBACK_GITHUB_REPOSITORY: 'team/app',
        FEEDBACK_GITHUB_API_ORIGIN: gitHub.url,
        API_URL: 'https://api-dev.example.test',
        WEB_CLIENT_ORIGIN: 'https://www-dev.example.test',
      };
      const origin = 'https://api-dev.example.test';
      const app = 'https://www-dev.example.test';
      const ask = (path: string, init?: RequestInit) =>
        worker.fetch(
          new Request(`${origin}/api/bug-reports${path}`, init),
          env,
          context
        );
      const health = await ask('/health');
      expect(await health.json()).toEqual({ receiving: true });

      const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const form = new FormData();
      form.set(
        'report',
        JSON.stringify({
          schema: 'bug-report/v1',
          id: '11111111-1111-4111-8111-000000000001',
          reporterId: '22222222-2222-4222-8222-222222222222',
          description: 'The board froze',
          createdAt: '2026-03-02T10:00:00.000Z',
          debugInfo: { events: [], details: [] },
        })
      );
      form.append('screenshot', new Blob([png], { type: 'image/png' }), 'shot');
      const send = (from: string) =>
        ask('', { method: 'POST', body: form, headers: { Origin: from } });
      expect((await send('https://elsewhere.example.test')).status).toBe(403);
      const sent = await send(app);
      expect(sent.status).toBe(201);
      expect(sent.headers.get('Access-Control-Allow-Origin')).toBe(app);

      const listed = await fetch(
        `${gitHub.url}/repos/team/app/issues?labels=bug-report&state=open`,
        { headers: { Authorization: 'Bearer secret-token' } }
      );
      const issues = (await listed.json()) as {
        title: string;
        body: string;
        labels: { name: string }[];
      }[];
      expect(issues.map((issue) => issue.title)).toEqual([
        'Bug report: The board froze',
      ]);
      expect(issues[0]?.labels.map((label) => label.name).sort()).toEqual([
        'bug',
        'bug-report',
      ]);
      const screenshot = /!\[Screenshot 1\]\(([^)]+)\)/.exec(
        issues[0]?.body ?? ''
      );
      const read = await worker.fetch(
        new Request(screenshot?.[1] ?? ''),
        env,
        context
      );
      expect(new Uint8Array(await read.arrayBuffer())).toEqual(png);
    } finally {
      await gitHub.close();
      await s3.stop();
    }
  });

  // regression: room-server-stale-game-registry-export
  test('exports the room class and scheduled handler in the application entrypoint', () => {
    expect(typeof RoomServerDurableObject).toBe('function');
    expect(typeof worker.scheduled).toBe('function');
  });
});
