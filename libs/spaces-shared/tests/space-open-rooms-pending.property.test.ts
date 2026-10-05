/**
 * Model-based: the pending-command buffer against a plain per-space queue.
 * Commands enqueue / flush / clear across a few spaces; a flush must deliver
 * exactly that space's buffered payloads, in order, once.
 */
import { describe, expect, test } from 'bun:test';
import type { SpaceOpenRoomsPending } from '@libs/spaces-shared/space-open-rooms-pending';
import { createSpaceOpenRoomsPending } from '@libs/spaces-shared/space-open-rooms-pending';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import type { RoomCommandPayload } from '@pkgs/room-root-shared/types';
import fc from 'fast-check';

type Model = { readonly queues: Map<string, number[]> };
type Real = { readonly pending: SpaceOpenRoomsPending };

const arbSpace = fc.constantFrom('s1', 's2', 's3');

function payload(n: number): RoomCommandPayload {
  return { type: 'test/cmd', payload: n } as RoomCommandPayload;
}

type Step = fc.Command<Model, Real>;

function step(label: string, exec: (m: Model, real: Real) => void): Step {
  return { check: () => true, run: exec, toString: () => label };
}

const arbEnqueue = fc
  .tuple(arbSpace, fc.integer({ min: 0, max: 99 }))
  .map(([spaceId, n]) =>
    step(`enqueue(${spaceId}, ${n})`, (model, real) => {
      real.pending.enqueue(spaceId, payload(n));
      model.queues.set(spaceId, [...(model.queues.get(spaceId) ?? []), n]);
    })
  );

const arbFlush = arbSpace.map((spaceId) =>
  step(`flush(${spaceId})`, (model, real) => {
    const delivered: unknown[] = [];
    real.pending.flush(spaceId, (p) => delivered.push(p.payload));
    expect(delivered).toEqual(model.queues.get(spaceId) ?? []);
    model.queues.delete(spaceId);
  })
);

const arbClear = arbSpace.map((spaceId) =>
  step(`clear(${spaceId})`, (model, real) => {
    real.pending.clear(spaceId);
    model.queues.delete(spaceId);
  })
);

const arbCommands = fc.commands([arbEnqueue, arbFlush, arbClear], {
  maxCommands: 40,
});

describe('createSpaceOpenRoomsPending', () => {
  test('behaves as an independent FIFO per space', () => {
    assertProperty(
      'pending buffer = per-space FIFO',
      fc.property(arbCommands, (commands) => {
        fc.modelRun(
          () => ({
            model: { queues: new Map<string, number[]>() },
            real: { pending: createSpaceOpenRoomsPending() },
          }),
          commands
        );
      })
    );
  });
});
