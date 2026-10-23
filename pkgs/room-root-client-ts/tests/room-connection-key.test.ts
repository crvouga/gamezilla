import { expect, test } from 'bun:test';
import { createRoomConnectionKey } from '@pkgs/room-root-client-ts/room-connection-key';
import { createComputed, createRoot, createSignal, on } from 'solid-js';

test('seventy fresh projections retain one connection until its identity changes', () => {
  // regression: room-projection-reconnect-loop
  createRoot((dispose) => {
    const [row, setRow] = createSignal({ id: 'room-1', revision: 0 });
    const [identity, setIdentity] = createSignal('alice');
    const [device, setDevice] = createSignal('phone');
    const [endpoint, setEndpoint] = createSignal('https://rooms.example');
    const key = createRoomConnectionKey(() =>
      row().id ? ([row().id, identity(), device(), endpoint()] as const) : null
    );
    let connections = 0;
    createComputed(
      on(key, () => {
        row().revision;
        connections++;
      })
    );
    for (let revision = 1; revision <= 70; revision++)
      setRow({ id: 'room-1', revision });
    expect(connections).toBe(1);
    setRow({ id: 'room-2', revision: 0 });
    expect(connections).toBe(2);
    setIdentity('bob');
    expect(connections).toBe(3);
    setDevice('tablet');
    expect(connections).toBe(4);
    setEndpoint('https://other-rooms.example');
    expect(connections).toBe(5);
    setRow({ id: '', revision: 0 });
    expect(connections).toBe(6);
    setRow({ id: '', revision: 1 });
    expect(connections).toBe(6);
    dispose();
  });
});
