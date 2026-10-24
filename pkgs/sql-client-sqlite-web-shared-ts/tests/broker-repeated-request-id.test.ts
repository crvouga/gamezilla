import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createBrokerCore } from '@pkgs/sql-client-sqlite-web-shared-ts/broker-core';
import type {
  BrokerToTabMessage,
  RpcRequest,
} from '@pkgs/sql-client-sqlite-web-shared-ts/rpc';

// regression: sqlite-broker-repeated-request-id-loses-response
test.each([false, true])(
  'same request ids in two tabs keep both replies, reversed: %p',
  async (reversed) => {
    const { clock, timers } = createHarnessClock();
    const broker = createBrokerCore({
      now: clock.now,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
    });
    const owner: BrokerToTabMessage[] = [];
    const left: BrokerToTabMessage[] = [];
    const right: BrokerToTabMessage[] = [];
    for (const [id, inbox] of [
      ['owner', owner],
      ['left', left],
      ['right', right],
    ] as const) {
      broker.attachPort({
        id,
        postMessage: (message) => {
          inbox.push(message);
        },
      });
      broker.handleMessage(id, {
        id: 'sw_1',
        dbName: 'app',
        op: 'connect',
        payload: {},
      });
    }
    for (let turn = 0; turn < 10; turn++) await Promise.resolve();
    owner.length = 0;
    left.length = 0;
    right.length = 0;
    for (const id of ['left', 'right'])
      broker.handleMessage(id, {
        id: 'sw_2',
        dbName: 'app',
        op: 'query',
        payload: { sql: 'SELECT 1', values: [] },
      });
    const forwarded = owner.filter(
      (message): message is RpcRequest<'query'> =>
        'op' in message && message.op === 'query'
    );
    expect(forwarded).toHaveLength(2);
    const replies = forwarded.map((message, index) => ({
      id: message.id,
      ok: true,
      result: [{ value: index === 0 ? 'left reply' : 'right reply' }],
    }));
    for (const reply of reversed ? [...replies].reverse() : replies)
      broker.handleMessage('owner', reply);
    expect(left).toEqual([
      { id: 'sw_2', ok: true, result: [{ value: 'left reply' }] },
    ]);
    expect(right).toEqual([
      { id: 'sw_2', ok: true, result: [{ value: 'right reply' }] },
    ]);
  }
);
