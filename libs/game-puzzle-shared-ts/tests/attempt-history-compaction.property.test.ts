import { expect, test } from 'bun:test';
import {
  advanceAttemptHistory,
  attemptHistoryActions,
  attemptHistoryStates,
  currentAttemptState,
} from '@libs/game-puzzle-shared-ts/attempt-history';
import {
  ATTEMPT_HISTORY_KEYFRAME,
  type AttemptCommand,
  type AttemptHistory,
  decodeAttemptHistory,
} from '@libs/game-puzzle-shared-ts/attempt-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import fc from 'fast-check';

/** A walk along a long line: many tiny moves, as a box-pushing game makes. */
const walk: PuzzleContent = {
  rulesVersion: 1,
  history: 'snapshots',
  rules: {
    validateDefinition: () => ({ valid: true }),
    initial: () => ({ accepted: true, state: 'at:0' }),
    validateState: () => ({ valid: true }),
    apply: (_definition, state, action) => {
      const at = Number(state.slice(3)) + (action === 'forward' ? 1 : -1);
      return at < 0
        ? { accepted: false, issues: [{ code: 'edge', message: 'Edge.' }] }
        : { accepted: true, state: `at:${at}` };
    },
    complete: () => false,
  },
};

type Reference = {
  readonly states: readonly string[];
  readonly cursor: number;
};

function step(
  history: AttemptHistory,
  reference: Reference,
  command: AttemptCommand
): { history: AttemptHistory; reference: Reference } {
  try {
    const next = advanceAttemptHistory({
      game: walk,
      definition: 'line',
      history,
      command,
    });
    const state = currentAttemptState(next);
    const kept =
      command.kind === 'play'
        ? [...reference.states.slice(0, reference.cursor + 1), state]
        : reference.states;
    return { history: next, reference: { states: kept, cursor: next.cursor } };
  } catch {
    return { history, reference };
  }
}

const commands = fc.array(
  fc.oneof(
    {
      weight: 6,
      arbitrary: fc.constant<AttemptCommand>({
        kind: 'play',
        action: 'forward',
      }),
    },
    {
      weight: 1,
      arbitrary: fc.constant<AttemptCommand>({ kind: 'play', action: 'back' }),
    },
    { weight: 2, arbitrary: fc.constant<AttemptCommand>({ kind: 'undo' }) },
    { weight: 2, arbitrary: fc.constant<AttemptCommand>({ kind: 'redo' }) }
  ),
  { maxLength: 160 }
);

test('a compacted history plays, undoes and redoes exactly like full snapshots', () => {
  assertProperty(
    'compacted attempt history matches a full-snapshot reference',
    fc.property(commands, (drawn) => {
      let history: AttemptHistory = {
        entries: [{ action: null, state: 'at:0' }],
        cursor: 0,
      };
      let reference: Reference = { states: ['at:0'], cursor: 0 };
      for (const command of drawn) {
        const before = JSON.stringify(history);
        ({ history, reference } = step(history, reference, command));
        if (JSON.stringify(history) === before) continue;
        expect(currentAttemptState(history)).toBe(
          reference.states[reference.cursor] ?? ''
        );
      }
      expect(
        attemptHistoryStates({ game: walk, definition: 'line', history })
      ).toEqual(reference.states);
      expect(decodeAttemptHistory(JSON.stringify(history))).toEqual(history);
      const stored = history.entries.filter(
        (entry) => entry.state !== undefined
      ).length;
      expect(stored).toBeLessThanOrEqual(
        Math.ceil(history.entries.length / ATTEMPT_HISTORY_KEYFRAME) + 1
      );
      expect(attemptHistoryActions(history)).toHaveLength(history.cursor);
    })
  );
});

test('a saved history that kept every state remains readable and continues', () => {
  const legacy: AttemptHistory = {
    entries: [
      { action: null, state: 'at:0' },
      { action: 'forward', state: 'at:1' },
      { action: 'forward', state: 'at:2' },
    ],
    cursor: 2,
  };
  const decoded = decodeAttemptHistory(JSON.stringify(legacy));
  expect(decoded).toEqual(legacy);
  if (decoded === null) throw new Error('legacy history refused');
  const undone = advanceAttemptHistory({
    game: walk,
    definition: 'line',
    history: decoded,
    command: { kind: 'undo' },
  });
  expect(currentAttemptState(undone)).toBe('at:1');
});

test('a history whose cursor or keyframe lost its state is refused', () => {
  for (const broken of [
    {
      entries: [{ action: null, state: 'at:0' }, { action: 'forward' }],
      cursor: 1,
    },
    { entries: [{ action: null }], cursor: 0 },
    {
      entries: [
        { action: null, state: 'at:0' },
        { action: null, state: 'at:1' },
      ],
      cursor: 1,
    },
  ])
    expect(decodeAttemptHistory(JSON.stringify(broken))).toBeNull();
});
