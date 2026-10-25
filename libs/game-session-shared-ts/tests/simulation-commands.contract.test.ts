import { expect, test } from 'bun:test';
import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import { arenaCodec, arenaGame } from './reference-arena-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

type Client = RoomClient<RoomState, Message, Message, string>;

async function arena() {
  const rig = await liveSessionRoom(false, arenaGame);
  const alice = await rig.connect('alice');
  const bob = await rig.connect('bob');
  const carol = await rig.connect('carol');
  const command = async (
    client: Client,
    side: string,
    sequence: number,
    options: { basis?: number; round?: number; turn?: string } = {}
  ) => {
    const snapshot = await requestState(client);
    client.sendSignal(
      SubmitSimulationInput({
        version: 1,
        epoch: snapshot.epoch,
        playerId: side,
        sequence,
        tick: options.basis ?? snapshot.tick,
        value: { round: options.round ?? 1, turn: options.turn ?? 'left' },
      })
    );
    await rig.settle();
  };
  const state = async () =>
    arenaCodec.decode((await requestState(alice)).state)!;
  return { rig, alice, bob, carol, command, state };
}

test('a command applies at the authority next uncommitted tick whatever tick the device names', async () => {
  const { rig, alice, bob, command, state } = await arena();
  try {
    await rig.advance(4);
    const basis = (await requestState(alice)).tick;
    await command(alice, 'white', 1, { basis });
    await command(bob, 'black', 1, { basis: basis - 2, turn: 'right' });
    await rig.advance(2);
    expect((await state()).log).toEqual([
      `${basis + 1}:black:1:right`,
      `${basis + 1}:white:1:left`,
    ]);
    expect((await requestState(alice)).acknowledged).toEqual({
      black: 1,
      white: 1,
    });
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test('a command based on a future or too old tick, another round, or a full queue is refused without effect', async () => {
  const { rig, alice, command, state } = await arena();
  try {
    await rig.advance(20);
    const basis = (await requestState(alice)).tick;
    await command(alice, 'white', 1, { basis: basis + 5 });
    await command(alice, 'white', 2, { basis: basis - 11 });
    await command(alice, 'white', 3, { round: 2 });
    expect(rig.errors).toHaveLength(3);
    await command(alice, 'white', 4);
    await command(alice, 'white', 5);
    await command(alice, 'white', 6);
    expect(rig.errors).toHaveLength(4);
    await command(alice, 'white', 5);
    expect(rig.errors).toHaveLength(4);
    await rig.advance(2);
    expect((await state()).log.map((entry) => entry.split(':')[2])).toEqual([
      '4',
      '5',
    ]);
  } finally {
    rig.dispose();
  }
});

test('a command issued in a finished round never applies in the next one', async () => {
  const { rig, alice, command, state } = await arena();
  try {
    await rig.advance(29);
    await command(alice, 'white', 1, { round: 1 });
    await rig.advance(3);
    const after = await state();
    expect(after.round).toBe(2);
    await command(alice, 'white', 2, { round: 1 });
    await rig.advance(2);
    expect((await state()).log).toEqual(after.log);
  } finally {
    rig.dispose();
  }
});

test('an absent rider keeps the arena running, retires after the grace period, and never forfeits for everyone', async () => {
  const { rig, alice, command, state } = await arena();
  try {
    await rig.advance(2);
    const epoch = (await requestState(alice)).epoch;
    rig.transports.get('carol')!.closeFromServer();
    await rig.settle();
    expect(rig.current().execution).toMatchObject({
      phase: 'running',
      missing: ['red'],
      expiresAt: null,
    });
    await command(alice, 'white', 1);
    await rig.advance(12);
    const during = await state();
    expect(during.retired).toEqual(['red']);
    expect(during.log.some((entry) => entry.endsWith(':white:1:left'))).toBe(
      true
    );
    expect((await requestState(alice)).epoch).toBe(epoch);
    rig.clock.advance(30_000);
    await rig.settle();
    expect(rig.current().status).toBe('active');
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test('a returning rider is no longer retired and the absence deadline waits only for everyone', async () => {
  const { rig, carol, state } = await arena();
  try {
    rig.transports.get('carol')!.closeFromServer();
    await rig.settle();
    await rig.transports.get('carol')!.connect();
    await carol.untilSynced();
    await rig.settle();
    await rig.advance(12);
    expect((await state()).retired).toEqual([]);
    expect(rig.current().execution!.missing).toEqual([]);
    for (const person of ['alice', 'bob', 'carol'])
      rig.transports.get(person)!.closeFromServer();
    await rig.settle();
    expect(rig.current().execution).toMatchObject({
      phase: 'running',
      missing: ['black', 'red', 'white'],
    });
    expect(rig.current().execution!.expiresAt).not.toBeNull();
    rig.clock.advance(30_000);
    await rig.settle();
    expect(rig.current()).toMatchObject({ status: 'cancelled' });
    expect(rig.clock.pendingOneShotCount()).toBe(0);
  } finally {
    rig.dispose();
  }
});

test('disposing a continuing arena leaves no scheduled work behind', async () => {
  const { rig } = await arena();
  await rig.advance(3);
  rig.transports.get('carol')!.closeFromServer();
  await rig.settle();
  rig.dispose();
  expect(rig.clock.pendingOneShotCount()).toBe(0);
});
