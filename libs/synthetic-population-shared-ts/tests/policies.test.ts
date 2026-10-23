import { expect, test } from 'bun:test';
import { behaviorStatechart } from '@libs/synthetic-population-shared-ts/behavior-statechart';
import { reconcileCheckpoint } from '@libs/synthetic-population-shared-ts/config';
import {
  chooseActivity,
  type PolicyInputs,
} from '@libs/synthetic-population-shared-ts/decision-policy';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';
import fc from 'fast-check';
import { createActor } from 'xstate';

const INPUT: PolicyInputs = {
  hasActiveMatch: false,
  hasQueueEntry: false,
  availableSpaces: ['space-card-alice', 'space-card-bob'],
  paused: false,
  draining: false,
  sessionElapsedMs: 0,
  sessionLimitMs: 60_000,
  hostingWeight: 0.3,
};

test('a policy never abandons active play for a break or a drain', () => {
  assertProperty(
    'active game priority',
    fc.property(
      fc.boolean(),
      fc.boolean(),
      fc.nat(),
      fc.integer(),
      (paused, draining, elapsed, seed) => {
        const decision = chooseActivity(
          {
            ...INPUT,
            hasActiveMatch: true,
            paused,
            draining,
            sessionElapsedMs: elapsed,
          },
          createHarnessIds(seed).random
        );
        expect(decision.activity).toBe('playing');
        const idle = chooseActivity(
          {
            ...INPUT,
            hasActiveMatch: false,
            paused: true,
            draining,
            sessionElapsedMs: elapsed,
          },
          createHarnessIds(seed).random
        );
        expect(idle.activity).toBe('loggingOut');
      }
    )
  );
});

test('seeded policies select only observed controls and replay controlled decisions', () => {
  assertProperty(
    'policy replay',
    fc.property(fc.integer(), (seed) => {
      const first = createHarnessIds(seed).random;
      const second = createHarnessIds(seed).random;
      const decisions = Array.from({ length: 20 }, () =>
        chooseActivity(INPUT, first)
      );
      expect(
        Array.from({ length: 20 }, () => chooseActivity(INPUT, second))
      ).toEqual(decisions);
      for (const decision of decisions)
        if (decision.targetControlId !== null)
          expect(INPUT.availableSpaces).toContain(decision.targetControlId);
    })
  );
});

test('statechart acknowledges each move before choosing the next, and recovery discards obsolete actions', () => {
  const actor = createActor(behaviorStatechart).start();
  try {
    for (const type of [
      'START',
      'AUTHENTICATED',
      'HOST',
      'READY',
      'WAIT',
      'MATCH',
      'TURN',
      'MOVE',
    ] as const)
      actor.send({ type });
    expect(
      actor.getSnapshot().matches({ playing: 'awaitingAcknowledgement' })
    ).toBe(true);
    actor.send({ type: 'ACKNOWLEDGED' });
    actor.send({ type: 'TURN' });
    expect(actor.getSnapshot().matches({ playing: 'choosing' })).toBe(true);
    actor.send({ type: 'RECOVER' });
    expect(actor.getSnapshot().matches('recovering')).toBe(true);
    actor.send({ type: 'RESTORED' });
    actor.send({ type: 'LOG_OUT' });
    actor.send({ type: 'STOP' });
    expect(actor.getSnapshot().matches('offline')).toBe(true);
  } finally {
    actor.stop();
  }
});

test('checkpoint reconciliation accepts stored JSON and safely restarts completed or incompatible sessions', () => {
  // regression: synthetic-population-stored-checkpoint-reset
  const baseline = reconcileCheckpoint(null, 1000, 'cedar');
  const active = {
    ...baseline,
    activity: 'playing',
    route: '/space/current',
    startedAtMs: 900,
    pendingOperationId: '00000000-0000-4000-8000-000000000001',
  };
  expect(reconcileCheckpoint(JSON.stringify(active), 2000, 'cedar')).toEqual({
    ...active,
    activity: 'recovering',
    pendingOperationId: null,
  });
  expect(
    reconcileCheckpoint({ ...active, activity: 'offline' }, 2000, 'cedar')
      .startedAtMs
  ).toBe(2000);
  expect(
    reconcileCheckpoint({ ...active, schemaVersion: 99 }, 2000, 'cedar').route
  ).toBe('/');
  expect(reconcileCheckpoint('{broken', 2000, 'cedar').startedAtMs).toBe(2000);
});

test('an incompatible snapshot preserves validated game references without resuming its pending action', () => {
  // regression: synthetic-population-incompatible-snapshot-loses-match
  const snapshot = {
    schemaVersion: 99,
    spaceId: '00000000-0000-4000-8000-000000000001',
    matchId: '00000000-0000-4000-8000-000000000002',
    pendingOperationId: '00000000-0000-4000-8000-000000000003',
  };
  const restored = reconcileCheckpoint(snapshot, 2000, 'cedar');
  expect(restored.route).toBe(`/space/${snapshot.spaceId}`);
  expect(restored.matchId).toBe(snapshot.matchId);
  expect(restored.pendingOperationId).toBeNull();
  expect(restored.activity).toBe('recovering');
});
