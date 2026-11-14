import { describe, expect, test } from 'bun:test';
import { privacyTimePasses } from '@libs/account-privacy-harness-ts/privacy-actions';
import { playCustomGameHistory } from '@libs/game-session-harness-ts/custom-game-history';
import { attemptHostPuzzleCommand } from '@libs/game-session-harness-ts/puzzle-room-probe';
import { queueRoomDraws } from '@libs/game-session-harness-ts/room-draws';
import {
  restoreDeviceSimulation,
  restoreSharedSimulation,
} from '@libs/game-session-harness-ts/simulation-fixtures';
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

  // regression: stack-history-has-no-room
  test("a history's moves cannot be sent to the stack room from the test process", async () => {
    const outcome = await outcomeOf(() =>
      playCustomGameHistory.act(stackHarness(), {
        spaceId: 'space-1',
        white: 'alice',
        black: 'bob',
        moves: ['e2e4'],
      })
    );
    expect(isHostLimit(outcome)).toBe(true);
  });

  // regression: stack-puzzle-command-has-no-room
  test('a puzzle command cannot be sent to the stack room from the test process', async () => {
    const outcome = await outcomeOf(() =>
      attemptHostPuzzleCommand.act(stackHarness(), 'alice', 'alice', 'hint')
    );
    expect(isHostLimit(outcome)).toBe(true);
  });

  // regression: stack-saved-game-rewrite
  test("a real browser's or the stack room's saved game cannot be rewritten", async () => {
    const device = await outcomeOf(() =>
      restoreDeviceSimulation(
        stackHarness(),
        { actor: 'alice', gameId: 'game-1' },
        (position) => position
      )
    );
    const room = await outcomeOf(() =>
      restoreSharedSimulation(stackHarness(), (position) => position)
    );
    expect(isHostLimit(device)).toBe(true);
    expect(isHostLimit(room)).toBe(true);
  });
});
