import { expect, test } from 'bun:test';
import {
  advanceAttemptHistory,
  currentAttemptState,
} from '@libs/game-puzzle-shared-ts/attempt-history';
import {
  type AttemptHistory,
  decodeAttemptHistory,
} from '@libs/game-puzzle-shared-ts/attempt-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { pileContent } from './pile-game';

test('snapshot navigation is reversible and never mutates an earlier history value', () => {
  assertProperty(
    'opaque snapshot history is persistent',
    fc.property(
      fc.integer({ min: 1, max: 9 }),
      fc.nat({ max: 9 }),
      (plays, drawn) => {
        const definition = 'pile:9:white';
        const game = pileContent();
        let history: AttemptHistory = {
          entries: [{ action: null, state: definition }],
          cursor: 0,
        };
        for (let i = 0; i < plays; i += 1) {
          const earlier = JSON.stringify(history);
          const next = advanceAttemptHistory({
            game,
            definition,
            history,
            command: { kind: 'play', action: 'take1' },
          });
          expect(JSON.stringify(history)).toBe(earlier);
          history = next;
        }
        const finished = history;
        const undos = Math.min(plays, drawn);
        for (let i = 0; i < undos; i += 1)
          history = advanceAttemptHistory({
            game,
            definition,
            history,
            command: { kind: 'undo' },
          });
        for (let i = 0; i < undos; i += 1)
          history = advanceAttemptHistory({
            game,
            definition,
            history,
            command: { kind: 'redo' },
          });
        expect(history).toEqual(finished);
        expect(decodeAttemptHistory(JSON.stringify(history))).toEqual(history);
        expect(
          game.rules.validateState(definition, currentAttemptState(history))
            .valid
        ).toBe(true);
      }
    )
  );
});

test('the history decoder refuses arbitrary external data or returns an addressable cursor', () => {
  assertProperty(
    'history decoder is total',
    fc.property(
      fc.oneof(fc.string(), fc.jsonValue().map(JSON.stringify)),
      (text) => {
        const decoded = decodeAttemptHistory(text);
        if (decoded === null) return;
        expect(decoded.entries[decoded.cursor]).toBeDefined();
        expect(decodeAttemptHistory(JSON.stringify(decoded))).toEqual(decoded);
      }
    )
  );
});
