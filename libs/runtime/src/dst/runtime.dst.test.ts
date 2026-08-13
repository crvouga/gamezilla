import { describe, expect, test } from 'bun:test';
import { asKeyword, asKeywordRecord } from '@pkgs/keyword/keyword';
import { sql } from '@pkgs/sql';
import type { Fetch } from '@pkgs/system';
import { serveFetch } from '@pkgs/system';

import { api, room } from '../shared/system';
import { openProductWorld } from './open-world';

const VALUE_KEY = asKeyword('sim/value');
const TEXT_ATTR = asKeyword('sim/text');

const apiImpl = api.implement((deps) => {
  return serveFetch(async (req) => {
    const url = new URL(req.url);
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      await deps.db.run(sql`insert into _dst_ping (id) values (null)`);
      return Response.json({ ok: true });
    }
    if (url.pathname === '/api/room') {
      const topic = url.searchParams.get('topic') ?? 'default';
      return deps.room(topic)(req);
    }
    return new Response('not found', { status: 404 });
  });
});

const roomImpl = room.implement((deps) => {
  return serveFetch(async (req) => {
    if (req.method === 'POST') {
      const text = await req.text();
      await deps.storage.put(
        VALUE_KEY,
        asKeywordRecord({ 'sim/text': text }, 'sim room')
      );
      return new Response('ok');
    }
    const row = await deps.storage.get(VALUE_KEY);
    const text =
      row && typeof row[TEXT_ATTR] === 'string' ? String(row[TEXT_ATTR]) : '';
    return new Response(text);
  });
});

const IMPLS = [apiImpl, roomImpl] as const;

describe('@libs/runtime DST', () => {
  test('same seed ⇒ identical trace', async () => {
    const run = async () => {
      const world = openProductWorld(99, IMPLS);
      const apiFetch = await world.spawn<Fetch>('api');
      expect((await (await apiFetch('http://api/api/health')).json()).ok).toBe(
        true
      );
      await apiFetch('http://api/api/room?topic=space:1', {
        method: 'POST',
        body: 'hello',
      });
      expect(
        await (await apiFetch('http://api/api/room?topic=space:1')).text()
      ).toBe('hello');
      const t = world.traceString();
      world.dispose();
      return t;
    };
    expect(await run()).toBe(await run());
  });

  test('api crash surfaces; restart recovers', async () => {
    const world = openProductWorld(3, IMPLS);
    const apiFetch = await world.spawn<Fetch>('api');
    expect((await (await apiFetch('http://api/api/health')).json()).ok).toBe(
      true
    );
    world.faults.crash('api');
    await expect(apiFetch('http://api/api/health')).rejects.toThrow(
      /network error/
    );
    world.faults.restart('api');
    expect((await (await apiFetch('http://api/api/health')).json()).ok).toBe(
      true
    );
    world.dispose();
  });

  test('partition world–api then heal', async () => {
    const world = openProductWorld(5, IMPLS);
    const apiFetch = await world.spawn<Fetch>('api');
    world.faults.partition('world', 'api');
    await expect(apiFetch('http://api/api/health')).rejects.toThrow(
      /partitioned/
    );
    world.faults.heal('world', 'api');
    expect((await (await apiFetch('http://api/api/health')).json()).ok).toBe(
      true
    );
    world.dispose();
  });

  test('wipe room storage is scoped to instance', async () => {
    const world = openProductWorld(8, IMPLS);
    const a = await world.spawn<Fetch>('room', 'space:a');
    const b = await world.spawn<Fetch>('room', 'space:b');
    await a('http://room/', { method: 'POST', body: 'A' });
    await b('http://room/', { method: 'POST', body: 'B' });
    await world.faults.wipe('room:space:a.storage');
    expect(await (await a('http://room/')).text()).toBe('');
    expect(await (await b('http://room/')).text()).toBe('B');
    expect(world.traceString()).toContain('fault@room:space:a.storage wipe');
    world.dispose();
  });
});
