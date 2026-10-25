import { expect, test } from 'bun:test';
import { SubmitSimulationInput } from '@libs/game-session-shared-ts/simulation-messages';
import {
  ClaimSimulationControl,
  SimulationSteeringChanged,
} from '@libs/game-session-shared-ts/simulation-steering';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import { arenaCodec, arenaGame } from './reference-arena-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

type Client = RoomClient<RoomState, Message, Message, string>;

test("one of a person's devices steers their seat until another of theirs claims it", async () => {
  const rig = await liveSessionRoom(false, arenaGame);
  try {
    const first = await rig.connect('alice');
    await rig.connect('bob');
    await rig.connect('carol');
    const other = await rig.connect('alice', undefined, 'alice-phone');
    const steering: Record<string, string>[] = [];
    other.subscribeSignal((message) => {
      if (SimulationSteeringChanged.is(message))
        steering.push(message.payload.steering);
    });
    let sequence = 0;
    const turn = async (device: Client) => {
      const snapshot = await requestState(device);
      device.sendSignal(
        SubmitSimulationInput({
          version: 1,
          epoch: snapshot.epoch,
          playerId: 'white',
          sequence: ++sequence,
          tick: snapshot.tick,
          value: { round: 1, turn: 'left' },
        })
      );
      await rig.settle();
      await rig.advance(1);
    };
    const applied = async () =>
      arenaCodec
        .decode((await requestState(first)).state)!
        .log.filter((entry) => entry.includes(':white:')).length;
    await rig.advance(2);
    await turn(other);
    expect(await applied()).toBe(0);
    await turn(first);
    expect(await applied()).toBe(1);
    other.sendSignal(ClaimSimulationControl({ version: 1 }));
    await rig.settle();
    expect(steering.at(-1)).toMatchObject({ white: 'alice-phone' });
    await turn(first);
    expect(await applied()).toBe(1);
    await turn(other);
    expect(await applied()).toBe(2);
    // Each device that does not steer is told so; nothing else goes wrong.
    expect(rig.errors).toEqual([
      expect.objectContaining({
        reason: 'another of your devices steers this game',
      }),
      expect.objectContaining({
        reason: 'another of your devices steers this game',
      }),
    ]);
  } finally {
    rig.dispose();
  }
});
