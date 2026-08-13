import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { asKeyword, asKeywordRecord } from '@pkgs/keyword/keyword';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import type { Kv } from '@pkgs/kv/interface';
import type { PubSub } from '@pkgs/pubsub/interface';
import {
  createInMemoryBus,
  createInMemoryPubSub,
} from '@pkgs/pubsub/testing/in-memory';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import {
  createWorld,
  decoratePort,
  defineSystem,
  type Fetch,
  keyed,
  resource,
  serveFetch,
} from './index';

function bunSqliteProvider() {
  const dbs = new Map<string, Database>();
  return decoratePort<SqlClient>(
    (address) => {
      let raw = dbs.get(address);
      if (!raw) {
        raw = new Database(':memory:');
        raw.run(
          'create table if not exists pings (id integer primary key, at integer)'
        );
        dbs.set(address, raw);
      }
      return new SqlClientImplBunSqlite(raw);
    },
    {
      wipe(_instance, address) {
        const raw = dbs.get(address);
        raw?.run('delete from pings');
      },
    }
  );
}

function kvProvider() {
  return decoratePort<Kv>(() => new KvImplInMemory(), {
    wipe(instance) {
      if (instance instanceof KvImplInMemory) {
        instance.clearForTest();
      }
    },
    corrupt(instance) {
      if (instance instanceof KvImplInMemory) {
        instance.armFault(new Error('kv corrupted'));
      }
    },
  });
}

function busProvider() {
  const buses = new Map<string, ReturnType<typeof createInMemoryBus>>();
  return decoratePort<PubSub>((address) => {
    let bus = buses.get(address);
    if (!bus) {
      bus = createInMemoryBus();
      buses.set(address, bus);
    }
    return createInMemoryPubSub({ bus });
  });
}

describe('@pkgs/system smoke', () => {
  const db = resource<SqlClient>();
  const events = resource<PubSub>();
  const room = keyed(
    resource<Fetch>()({
      storage: resource<Kv>(),
    })
  );
  const api = resource<Fetch>()({
    db,
    events,
    room,
    cache: resource<Kv>(),
  });
  const client = resource<never>()({
    db: resource<SqlClient>(),
    events,
    api,
    room,
  });

  const system = defineSystem({ db, events, api, room, client });

  type AppUi = {
    ping(): Promise<string>;
    publish(msg: string): Promise<void>;
    inbox(): number;
  };

  const apiImpl = api.implement((deps) => {
    return serveFetch(async (req) => {
      if (new URL(req.url).pathname === '/ping') {
        await deps.db.run(sql`insert into pings (at) values (${1})`);
        return Response.json({ ok: true });
      }
      return new Response('nope', { status: 404 });
    });
  });

  const clientImpl = client.implement<AppUi>((deps) => {
    let inbox = 0;
    deps.events.subscribe('msg', () => {
      inbox++;
    });
    return {
      async ping() {
        const res = await deps.api('http://api/ping');
        return res.ok ? 'ok' : 'fail';
      },
      async publish(msg: string) {
        await deps.events.publish('msg', msg);
      },
      inbox: () => inbox,
    };
  });

  const VALUE_KEY = asKeyword('sim/value');
  const TEXT_ATTR = 'sim/text' as const;

  const roomImpl = room.implement((deps) => {
    return serveFetch(async (req) => {
      const url = new URL(req.url);
      if (url.pathname.endsWith('/set') || req.method === 'POST') {
        const text = await req.text();
        await deps.storage.put(
          VALUE_KEY,
          asKeywordRecord({ [TEXT_ATTR]: text }, 'sim room value')
        );
        return new Response('ok');
      }
      const row = await deps.storage.get(VALUE_KEY);
      const text =
        row && typeof row[asKeyword(TEXT_ATTR)] === 'string'
          ? String(row[asKeyword(TEXT_ATTR)])
          : '';
      return new Response(text);
    });
  });

  const stubTimers = {
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
  };

  function openWorld(seed: number | string) {
    return createWorld(system, {
      seed,
      timers: stubTimers,
      impls: [apiImpl, clientImpl, roomImpl],
      provide: {
        db: bunSqliteProvider(),
        events: busProvider(),
        'api.cache': kvProvider(),
        'client.db': bunSqliteProvider(),
        'room.storage': kvProvider(),
        'room:*.storage': kvProvider(),
      },
    });
  }

  test('same seed ⇒ identical trace', async () => {
    const run = async () => {
      const world = openWorld(42);
      const ui = await world.spawn<AppUi>('client', 'alice');
      expect(await ui.ping()).toBe('ok');
      const t = world.traceString();
      world.dispose();
      return t;
    };
    expect(await run()).toBe(await run());
  });

  test('crash of shared api surfaces as network error; restart recovers', async () => {
    const world = openWorld(7);
    const ui = await world.spawn<AppUi>('client', 'bob');
    expect(await ui.ping()).toBe('ok');
    world.faults.crash('api');
    await expect(ui.ping()).rejects.toThrow(/network error/);
    world.faults.restart('api');
    expect(await ui.ping()).toBe('ok');
    world.dispose();
  });

  test('partition drops expected calls', async () => {
    const world = openWorld(9);
    const ui = await world.spawn<AppUi>('client', 'carol');
    expect(world.instances.has('client:carol')).toBe(true);
    expect(world.instances.has('api')).toBe(true);
    world.faults.partition('client:carol', 'api');
    expect(world.partitions.has('api|client:carol')).toBe(true);
    await expect(ui.ping()).rejects.toThrow(/partitioned/);
    world.faults.heal('client:carol', 'api');
    expect(world.partitions.size).toBe(0);
    expect(await ui.ping()).toBe('ok');
    world.dispose();
  });

  test('wipe on owned client db does not wipe shared db', async () => {
    const world = openWorld(11);
    const ui = await world.spawn<AppUi>('client', 'dave');
    await ui.ping();
    await world.faults.wipe('client:dave.db');
    expect(await ui.ping()).toBe('ok');
    world.dispose();
  });

  test('keyed room instances have isolated storage', async () => {
    const world = openWorld(13);
    const a = await world.spawn<Fetch>('room', 'space:1');
    const b = await world.spawn<Fetch>('room', 'space:2');
    await a('http://room/set', { method: 'POST', body: 'one' });
    await b('http://room/set', { method: 'POST', body: 'two' });
    expect(await (await a('http://room/get')).text()).toBe('one');
    expect(await (await b('http://room/get')).text()).toBe('two');
    await world.faults.wipe('room:space:1.storage');
    // After wipe without clear-hook recreating, storage instance is dropped;
    // next call rebuilds empty storage.
    expect(await (await a('http://room/get')).text()).toBe('');
    expect(await (await b('http://room/get')).text()).toBe('two');
    world.dispose();
  });

  test('defineSystem rejects unnamed shared resources', () => {
    const shared = resource<SqlClient>();
    const a = resource<Fetch>()({ db: shared });
    const b = resource<Fetch>()({ db: shared });
    expect(() => defineSystem({ a, b })).toThrow(/shared resource/);
  });
});
