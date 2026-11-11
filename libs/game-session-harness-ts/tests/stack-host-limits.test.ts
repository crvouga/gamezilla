import { describe, expect, test } from 'bun:test';
import { privacyTimePasses } from '@libs/account-privacy-harness-ts/privacy-actions';
import { queueRoomDraws } from '@libs/game-session-harness-ts/room-draws';
import { isHostLimit } from '@pkgs/gherkin-shared-ts/registry';

/** A harness attached to a separately booted stack, on a wall clock. */
function stackHarness() {
  return {
    session: {
      caps: new Set<string>(),
      ports: { http: { kind: 'stack' } },
      waitForIdle: () => Promise.resolve(),
    },
    harness: { roomNode: {} },
  } as never;
}

function outcomeOf(run: () => unknown): Promise<unknown> {
  return Promise.resolve()
    .then(run)
    .then(
      () => null,
      (error: unknown) => error
    );
}

describe('what a stack host cannot do ends the scenario as a host limit', () => {
  // regression: stack-room-draws-ignored
  test("the stack room's random draws cannot be chosen from the test process", async () => {
    const outcome = await outcomeOf(() =>
      queueRoomDraws(stackHarness(), [0.5])
    );
    expect(isHostLimit(outcome)).toBe(true);
  });

  // regression: wall-clock-privacy-time-passes
  test('days cannot pass on a wall clock', async () => {
    const outcome = await outcomeOf(() =>
      privacyTimePasses.act(stackHarness(), 30 * 86_400_000)
    );
    expect(isHostLimit(outcome)).toBe(true);
  });
});
