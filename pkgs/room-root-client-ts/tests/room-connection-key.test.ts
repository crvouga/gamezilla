import { expect, test } from 'bun:test';
import { createRoomConnectionKey } from '@pkgs/room-root-client-ts/room-connection-key';
import { createEffect, createRoot, createSignal, flush } from 'solid-js';

test('seventy fresh projections retain one connection until its identity changes', () => {
  // regression: room-projection-reconnect-loop
  const [row, setRow] = createSignal({ id: 'room-1', revision: 0 });
  const [identity, setIdentity] = createSignal('alice');
  const [device, setDevice] = createSignal('phone');
  const [endpoint, setEndpoint] = createSignal('https://rooms.example');
  let connections = 0;
  const dispose = createRoot((cleanup) => {
    const key = createRoomConnectionKey(() =>
      row().id ? ([row().id, identity(), device(), endpoint()] as const) : null
    );
    createEffect(key, () => {
      connections++;
    });
    return cleanup;
  });
  flush();
  for (let revision = 1; revision <= 70; revision++) {
    setRow({ id: 'room-1', revision });
    flush();
  }
  expect(connections).toBe(1);
  setRow({ id: 'room-2', revision: 0 });
  flush();
  expect(connections).toBe(2);
  setIdentity('bob');
  flush();
  expect(connections).toBe(3);
  setDevice('tablet');
  flush();
  expect(connections).toBe(4);
  setEndpoint('https://other-rooms.example');
  flush();
  expect(connections).toBe(5);
  setRow({ id: '', revision: 0 });
  flush();
  expect(connections).toBe(6);
  setRow({ id: '', revision: 1 });
  flush();
  expect(connections).toBe(6);
  dispose();
});
