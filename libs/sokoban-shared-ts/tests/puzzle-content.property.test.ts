import { expect, test } from 'bun:test';
import {
  eraseSokobanSquare,
  paintSokobanSquare,
} from '@libs/sokoban-shared-ts/sokoban-board-edits';
import { encodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import { sokobanGameShared } from '@libs/sokoban-shared-ts/sokoban-game';
import {
  applySokobanMove,
  decodeSokobanPosition,
  encodeSokobanAction,
  encodeSokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-position';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { sokobanStarterPack } from '@libs/sokoban-shared-ts/sokoban-starter-pack';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  assertPuzzleContent,
  replayPuzzleEvidence,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import fc from 'fast-check';
import {
  definitionBoard,
  directionsArb,
  LARGEST_ROWS,
  puzzleBoardArb,
  rowsText,
  startOf,
} from './sokoban-fixtures';

const { rules } = sokobanPuzzleContent;

test('the content registers as the sokoban game with its starter pack', () => {
  expect(() =>
    assertPuzzleContent('sokoban', sokobanPuzzleContent)
  ).not.toThrow();
  expect(sokobanGameShared.id).toBe('sokoban');
  expect(sokobanGameShared.puzzleContent).toBe(sokobanPuzzleContent);
  expect(sokobanPuzzleContent).toMatchObject({
    rulesVersion: 1,
    history: 'snapshots',
  });
  expect(sokobanPuzzleContent.solver).toBeUndefined();
  expect(sokobanPuzzleContent.bundledPacks).toEqual([sokobanStarterPack]);
});

test('the starter pack is four distinct original puzzles with stable ids', () => {
  expect(sokobanStarterPack).toMatchObject({
    id: 'sokoban-starter',
    title: 'Warehouse basics',
  });
  expect(sokobanStarterPack.puzzles.map((puzzle) => puzzle.id)).toEqual([
    'sokoban-starter-1',
    'sokoban-starter-2',
    'sokoban-starter-3',
    'sokoban-starter-4',
  ]);
  const definitions = sokobanStarterPack.puzzles.map((p) => p.definition);
  expect(new Set(definitions).size).toBe(4);
  for (const puzzle of sokobanStarterPack.puzzles) {
    expect(rules.validateDefinition(puzzle.definition)).toEqual({
      valid: true,
    });
    const replay = replayPuzzleEvidence(
      rules,
      puzzle.definition,
      puzzle.witness
    );
    expect(replay.valid).toBe(true);
    if (!replay.valid) continue;
    expect(rules.complete(puzzle.definition, replay.evidence.state)).toBe(true);
    expect(
      sokobanPuzzleContent.validatePublication?.(
        puzzle.definition,
        replay.evidence
      )
    ).toEqual({ valid: true });
    for (const other of sokobanStarterPack.puzzles) {
      if (other === puzzle) continue;
      const elsewhere = replayPuzzleEvidence(
        rules,
        other.definition,
        puzzle.witness
      );
      expect(
        elsewhere.valid &&
          rules.complete(other.definition, elsewhere.evidence.state)
      ).toBe(false);
    }
  }
  const crateCounts = sokobanStarterPack.puzzles.map(
    (puzzle) => definitionBoard(puzzle.definition).crates.length
  );
  expect(crateCounts).toEqual([1, 1, 2, 2]);
});

test('a witness is no proof for a board edited after it', () => {
  for (const puzzle of sokobanStarterPack.puzzles) {
    const board = definitionBoard(puzzle.definition);
    const replay = replayPuzzleEvidence(
      rules,
      puzzle.definition,
      puzzle.witness
    );
    if (!replay.valid) throw new Error('starter witness refused');
    const end = decodeSokobanPosition(board, replay.evidence.state);
    if (!end.valid) throw new Error('starter end unreadable');
    const goal = end.value.crates[0]!;
    // Moving a goal to plain floor changes no move, only where crates belong.
    const spare = board.squares.indexOf('floor');
    const erased = eraseSokobanSquare(board, goal);
    if (!erased.valid) throw new Error('erase refused');
    const moved = paintSokobanSquare(
      erased.value,
      { x: spare % board.width, y: Math.floor(spare / board.width) },
      'goal'
    );
    if (!moved.valid) throw new Error('paint refused');
    const edited = encodeSokobanBoard(moved.value);
    expect(rules.validateDefinition(edited)).toEqual({ valid: true });
    const again = replayPuzzleEvidence(rules, edited, puzzle.witness);
    expect(again.valid && rules.complete(edited, again.evidence.state)).toBe(
      false
    );
    expect(
      sokobanPuzzleContent.validatePublication?.(
        edited,
        again.valid ? again.evidence : undefined
      )
    ).toMatchObject({ valid: false, issues: [{ code: 'needs_playtest' }] });
  }
});

test('publication needs a completed playtest of this board', () => {
  const definition = sokobanStarterPack.puzzles[0]!.definition;
  const needsPlaytest = {
    valid: false,
    issues: [
      {
        code: 'needs_playtest',
        message: 'Complete a playtest of this board before publication.',
      },
    ],
  };
  expect(sokobanPuzzleContent.validatePublication?.(definition)).toEqual(
    needsPlaytest
  );
  const start = rules.initial(definition);
  if (!start.accepted) throw new Error('starter refused');
  expect(
    sokobanPuzzleContent.validatePublication?.(definition, {
      actions: [],
      state: start.state,
    })
  ).toEqual(needsPlaytest);
  expect(
    sokobanPuzzleContent.validatePublication?.(rowsText(' $.'), {
      actions: [],
      state: start.state,
    })
  ).toMatchObject({ valid: false, issues: [{ code: 'needs_worker' }] });
});

test('the opaque rules agree with the Sokoban moves, counts and completion', () => {
  assertProperty(
    'opaque rules',
    fc.property(
      puzzleBoardArb({ maxWidth: 6, maxHeight: 5, maxCrates: 3 }),
      directionsArb(30),
      (board, directions) => {
        const definition = encodeSokobanBoard(board);
        expect(rules.validateDefinition(definition)).toEqual({ valid: true });
        const initial = rules.initial(definition);
        if (!initial.accepted) throw new Error('playable board refused');
        let position = startOf(board);
        let state = initial.state;
        expect(state).toBe(encodeSokobanPosition(position));
        for (const direction of directions) {
          const expected = applySokobanMove(board, position, direction);
          const changed = rules.apply(
            definition,
            state,
            encodeSokobanAction(direction)
          );
          expect(changed.accepted).toBe(expected.valid);
          if (!changed.accepted || !expected.valid) {
            if (!changed.accepted && !expected.valid)
              expect(changed.issues).toEqual(expected.issues);
            continue;
          }
          position = expected.value;
          state = changed.state;
          expect(state).toBe(encodeSokobanPosition(position));
          expect(rules.validateState(definition, state)).toEqual({
            valid: true,
          });
          expect(sokobanPuzzleContent.statistics?.(definition, state)).toEqual({
            moves: position.moves,
            pushes: position.pushes,
          });
        }
      }
    )
  );
});

test('untrusted definitions, states and actions are refused, never thrown', () => {
  const definition = sokobanStarterPack.puzzles[2]!.definition;
  const start = rules.initial(definition);
  if (!start.accepted) throw new Error('starter refused');
  assertProperty(
    'opaque boundary',
    fc.property(
      fc.oneof(
        fc.string(),
        fc.jsonValue().map((value) => JSON.stringify(value))
      ),
      (text) => {
        expect(() => rules.validateDefinition(text)).not.toThrow();
        expect(() => rules.initial(text)).not.toThrow();
        expect(() => rules.validateState(definition, text)).not.toThrow();
        expect(() => rules.apply(definition, start.state, text)).not.toThrow();
        expect(() => rules.apply(text, start.state, 'r')).not.toThrow();
        expect(() => rules.complete(definition, text)).not.toThrow();
        expect(() =>
          sokobanPuzzleContent.statistics?.(text, text)
        ).not.toThrow();
        expect(() =>
          sokobanPuzzleContent.validatePublication?.(text, {
            actions: [],
            state: text,
          })
        ).not.toThrow();
      }
    )
  );
  expect(rules.apply(definition, start.state, 'up')).toMatchObject({
    accepted: false,
    issues: [{ code: 'invalid_action' }],
  });
  expect(rules.initial(rowsText(' $.'))).toMatchObject({
    accepted: false,
    issues: [{ code: 'needs_worker' }],
  });
  expect(sokobanPuzzleContent.statistics?.(definition, 'broken')).toEqual({});
});

test('a 20 by 20 board plays through the rules, and 21 is refused', () => {
  const definition = rowsText(...LARGEST_ROWS);
  expect(rules.validateDefinition(definition)).toEqual({ valid: true });
  const actions = Array.from({ length: 2000 }, (_, index) =>
    'rdlu'.charAt((index * 5 + Math.floor(index / 11)) % 4)
  );
  let state = rules.initial(definition);
  const accepted: string[] = [];
  for (const action of actions) {
    if (!state.accepted) break;
    const next = rules.apply(definition, state.state, action);
    if (!next.accepted) continue;
    state = next;
    accepted.push(action);
  }
  if (!state.accepted) throw new Error('the largest board was refused');
  expect(accepted.length).toBeGreaterThan(1000);
  expect(rules.validateState(definition, state.state)).toEqual({ valid: true });
  expect(replayPuzzleEvidence(rules, definition, accepted)).toEqual({
    valid: true,
    evidence: { actions: accepted, state: state.state },
  });
  const wider = rowsText(...LARGEST_ROWS.map((row) => `${row} `));
  const taller = rowsText(...LARGEST_ROWS, ' '.repeat(20));
  for (const text of [wider, taller])
    expect(rules.validateDefinition(text)).toMatchObject({
      valid: false,
      issues: [{ code: 'board_too_large' }],
    });
});
