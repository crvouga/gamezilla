import { describe, expect, test } from 'bun:test';
import type { HttpClient } from '@pkgs/http-client';

import { createEventLog } from '../events';
import { createMeshedHttp, createSimMesh } from '../network';
import { createSeededRng } from '../rng';

describe('createMeshedHttp', () => {
  test('records request and response', async () => {
    const events = createEventLog({ now: () => 0 });
    const mesh = createSimMesh({
      rng: createSeededRng(1).fork('mesh'),
      events,
      now: () => 0,
      schedule: (fn) => fn(),
    });
    mesh.registerEdge('alice', 'server', 'http');
    const raw: HttpClient = {
      fetch: async () => new Response('ok', { status: 200 }),
    };
    const http = createMeshedHttp({
      from: 'alice',
      to: 'server',
      raw,
      mesh,
      events,
    });
    const res = await http.fetch('http://sim.local/api');
    expect(res.status).toBe(200);
    const kinds = events.snapshot().map((e) => e.kind);
    expect(kinds).toContain('http.request');
    expect(kinds).toContain('http.response');
  });

  test('asymmetric: request delivered, response lost', async () => {
    const events = createEventLog({ now: () => 0 });
    const mesh = createSimMesh({
      rng: createSeededRng(1).fork('mesh'),
      events,
      now: () => 0,
      schedule: (fn) => fn(),
    });
    mesh.registerEdge('alice', 'server', 'http');
    mesh.partition('alice', 'server', { direction: 'to' });
    let hit = false;
    const raw: HttpClient = {
      fetch: async () => {
        hit = true;
        return new Response('ok', { status: 200 });
      },
    };
    const http = createMeshedHttp({
      from: 'alice',
      to: 'server',
      raw,
      mesh,
      events,
    });
    await expect(http.fetch('http://sim.local/api')).rejects.toThrow(
      /response/
    );
    expect(hit).toBe(true);
  });

  test('crashOn mid-request via event matcher', async () => {
    const events = createEventLog({ now: () => 0 });
    const mesh = createSimMesh({
      rng: createSeededRng(1).fork('mesh'),
      events,
      now: () => 0,
      schedule: (fn) => fn(),
    });
    mesh.registerEdge('alice', 'server', 'http');
    let crashed = false;
    const unsub = events.subscribe((event) => {
      if (event.kind === 'http.request' && !crashed) {
        crashed = true;
        mesh.partition('alice', 'server');
      }
    });
    const raw: HttpClient = {
      fetch: async () => new Response('ok', { status: 200 }),
    };
    const http = createMeshedHttp({
      from: 'alice',
      to: 'server',
      raw,
      mesh,
      events,
    });
    // First request: request goes through, then partition may affect response
    // depending on timing — arm partition after request event.
    try {
      await http.fetch('http://sim.local/x');
    } catch {
      // may fail if reverse partitioned after request
    }
    unsub();
    expect(crashed).toBe(true);
  });
});
