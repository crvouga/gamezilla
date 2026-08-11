import { describe, expect, test } from 'bun:test';
import { type BrokerPort, createBrokerCore } from './broker-core';
import type { BrokerToTabMessage } from './rpc';

function mockTimers() {
  let now = 0;
  const timeouts = new Map<number, { fn: () => void; due: number }>();
  let nextId = 1;
  return {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => {
      const id = nextId++;
      timeouts.set(id, { fn, due: now + ms });
      return id;
    },
    clearTimeout: (id: unknown) => {
      timeouts.delete(id as number);
    },
    advance: (ms: number) => {
      now += ms;
      for (const [id, entry] of [...timeouts]) {
        if (entry.due <= now) {
          timeouts.delete(id);
          entry.fn();
        }
      }
    },
  };
}

function mockPort(id: string, inbox: BrokerToTabMessage[]): BrokerPort {
  return {
    id,
    postMessage: (message) => {
      inbox.push(message);
    },
  };
}

describe('broker-core', () => {
  test('concurrent connect dedupes to one owner', async () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const aInbox: BrokerToTabMessage[] = [];
    const bInbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('a', aInbox));
    broker.attachPort(mockPort('b', bInbox));

    broker.handleMessage('a', {
      id: 'c1',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    broker.handleMessage('b', {
      id: 'c2',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });

    await Promise.resolve();
    await Promise.resolve();

    const aRes = aInbox.find((m) => 'ok' in m && m.id === 'c1') as {
      ok: true;
      result: { role: string };
    };
    const bRes = bInbox.find((m) => 'ok' in m && m.id === 'c2') as {
      ok: true;
      result: { role: string };
    };
    expect(aRes.result.role).toBe('owner');
    expect(bRes.result.role).toBe('proxy');
    expect(broker.getSlot('db1')?.refCount).toBe(2);
    expect(broker.getSlot('db1')?.ownerPortId).toBe('a');
  });

  test('refcount disconnect schedules close after grace', async () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const inbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('a', inbox));
    broker.handleMessage('a', {
      id: 'c1',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    await Promise.resolve();
    broker.handleMessage('a', {
      id: 'd1',
      dbName: 'db1',
      op: 'disconnect',
      payload: {},
    });
    expect(broker.getSlot('db1')?.refCount).toBe(0);
    timers.advance(4_999);
    expect(broker.getSlot('db1')).toBeDefined();
    timers.advance(2);
    expect(broker.getSlot('db1')).toBeUndefined();
  });

  test('routes proxy RPC to owner and returns response', async () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const ownerInbox: BrokerToTabMessage[] = [];
    const proxyInbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('owner', ownerInbox));
    broker.attachPort(mockPort('proxy', proxyInbox));
    broker.handleMessage('owner', {
      id: 'c1',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    broker.handleMessage('proxy', {
      id: 'c2',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    await Promise.resolve();
    await Promise.resolve();
    ownerInbox.length = 0;
    proxyInbox.length = 0;

    broker.handleMessage('proxy', {
      id: 'q1',
      dbName: 'db1',
      op: 'query',
      payload: { sql: 'SELECT 1', values: [] },
    });
    const forwarded = ownerInbox.find((m) => 'op' in m && m.id === 'q1') as {
      id: string;
      from?: string;
    };
    expect(forwarded.from).toBe('proxy');

    broker.handleMessage('owner', {
      id: 'q1',
      ok: true,
      result: [{ n: 1 }],
    });
    const back = proxyInbox.find((m) => 'ok' in m && m.id === 'q1') as {
      ok: true;
      result: unknown;
    };
    expect(back.result).toEqual([{ n: 1 }]);
  });

  test('heartbeat reaper detaches silent ports and promotes owner', async () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const aInbox: BrokerToTabMessage[] = [];
    const bInbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('a', aInbox));
    broker.attachPort(mockPort('b', bInbox));
    broker.handleMessage('a', {
      id: 'c1',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    broker.handleMessage('b', {
      id: 'c2',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    await Promise.resolve();
    await Promise.resolve();

    // Age past the reap window, then keep b alive with a heartbeat.
    timers.advance(16_000);
    broker.handleMessage('b', {
      id: 'h1',
      dbName: 'db1',
      op: 'heartbeat',
      payload: {},
    });
    broker.tickHeartbeatReaper();

    expect(broker.getSlot('db1')?.ownerPortId).toBe('b');
    const become = bInbox.find((m) => 'op' in m && m.op === 'becomeOwner');
    expect(become).toBeDefined();
  });

  test('force-release-all waits for owner releaseOwner ack before clearing', async () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const ownerInbox: BrokerToTabMessage[] = [];
    const resetInbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('owner', ownerInbox));
    broker.attachPort(mockPort('reset', resetInbox));
    broker.handleMessage('owner', {
      id: 'c1',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    await Promise.resolve();
    ownerInbox.length = 0;

    broker.handleMessage('reset', {
      id: 'force-release-all',
      type: 'force-release-all',
    });
    const release = ownerInbox.find(
      (m) => 'op' in m && m.op === 'releaseOwner'
    ) as { id: string; op: string };
    expect(release).toBeDefined();
    // Slots stay until the owner finishes closeAsync (ack).
    expect(broker.getSlot('db1')).toBeDefined();
    expect(
      resetInbox.find((m) => 'ok' in m && m.id === 'force-release-all')
    ).toBeUndefined();

    broker.handleMessage('owner', {
      id: release.id,
      ok: true,
      result: null,
    });
    expect(broker.getSlot('db1')).toBeUndefined();
    const ack = resetInbox.find(
      (m) => 'ok' in m && m.id === 'force-release-all'
    ) as { ok: true };
    expect(ack.ok).toBe(true);
  });

  test('force-release-all clears slots on owner-ack timeout', async () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const ownerInbox: BrokerToTabMessage[] = [];
    const resetInbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('owner', ownerInbox));
    broker.attachPort(mockPort('reset', resetInbox));
    broker.handleMessage('owner', {
      id: 'c1',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    await Promise.resolve();

    broker.handleMessage('reset', {
      id: 'force-release-all',
      type: 'force-release-all',
    });
    expect(broker.getSlot('db1')).toBeDefined();
    timers.advance(4_000);
    expect(broker.getSlot('db1')).toBeUndefined();
    const ack = resetInbox.find(
      (m) => 'ok' in m && m.id === 'force-release-all'
    ) as { ok: true };
    expect(ack.ok).toBe(true);
  });

  test('fans out db-changed to peer ports only', async () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const aInbox: BrokerToTabMessage[] = [];
    const bInbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('a', aInbox));
    broker.attachPort(mockPort('b', bInbox));
    broker.handleMessage('a', {
      id: 'c1',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    broker.handleMessage('b', {
      id: 'c2',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    await Promise.resolve();
    await Promise.resolve();
    aInbox.length = 0;
    bInbox.length = 0;

    broker.handleMessage('a', {
      type: 'db-changed',
      dbName: 'db1',
    });
    expect(aInbox).toHaveLength(0);
    expect(bInbox).toEqual([{ type: 'db-changed', dbName: 'db1' }]);
  });

  test('proxy RPC with no owner returns E_LEADER_LOST', () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const inbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('proxy', inbox));
    broker.handleMessage('proxy', {
      id: 'q1',
      dbName: 'missing',
      op: 'query',
      payload: { sql: 'SELECT 1', values: [] },
    });
    const res = inbox.find((m) => 'ok' in m && m.id === 'q1') as {
      ok: false;
      error: { code?: string };
    };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('E_LEADER_LOST');
  });

  test('detach owner mid-proxy RPC returns E_LEADER_LOST immediately', async () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const ownerInbox: BrokerToTabMessage[] = [];
    const proxyInbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('owner', ownerInbox));
    broker.attachPort(mockPort('proxy', proxyInbox));
    broker.handleMessage('owner', {
      id: 'c1',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    broker.handleMessage('proxy', {
      id: 'c2',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    await Promise.resolve();
    await Promise.resolve();
    proxyInbox.length = 0;

    broker.handleMessage('proxy', {
      id: 'q1',
      dbName: 'db1',
      op: 'query',
      payload: { sql: 'SELECT 1', values: [] },
    });
    broker.detachPort('owner');

    const res = proxyInbox.find((m) => 'ok' in m && m.id === 'q1') as {
      ok: false;
      error: { code?: string };
    };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('E_LEADER_LOST');
  });

  test('force-release-all rejects in-flight proxy RPCs', async () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const ownerInbox: BrokerToTabMessage[] = [];
    const proxyInbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('owner', ownerInbox));
    broker.attachPort(mockPort('proxy', proxyInbox));
    broker.handleMessage('owner', {
      id: 'c1',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    broker.handleMessage('proxy', {
      id: 'c2',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    await Promise.resolve();
    await Promise.resolve();
    proxyInbox.length = 0;

    broker.handleMessage('proxy', {
      id: 'q1',
      dbName: 'db1',
      op: 'query',
      payload: { sql: 'SELECT 1', values: [] },
    });
    broker.forceReleaseAll();
    // Proxies are rejected immediately; slots clear after owner ack / timeout.
    const res = proxyInbox.find((m) => 'ok' in m && m.id === 'q1') as {
      ok: false;
      error: { code?: string };
    };
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('E_LEADER_LOST');
    timers.advance(4_000);
    expect(broker.getSlot('db1')).toBeUndefined();
  });

  test('reconnect during close grace cancels releaseOwner', async () => {
    const timers = mockTimers();
    const broker = createBrokerCore(timers);
    const inbox: BrokerToTabMessage[] = [];
    broker.attachPort(mockPort('a', inbox));
    broker.handleMessage('a', {
      id: 'c1',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    await Promise.resolve();
    broker.handleMessage('a', {
      id: 'd1',
      dbName: 'db1',
      op: 'disconnect',
      payload: {},
    });
    inbox.length = 0;
    broker.handleMessage('a', {
      id: 'c2',
      dbName: 'db1',
      op: 'connect',
      payload: {},
    });
    await Promise.resolve();
    timers.advance(10_000);
    expect(broker.getSlot('db1')?.refCount).toBe(1);
    expect(inbox.some((m) => 'op' in m && m.op === 'releaseOwner')).toBe(false);
  });
});
