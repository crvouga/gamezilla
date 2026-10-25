import { expect, test } from 'bun:test';
import type { ContentBody } from '@libs/game-puzzle-shared-ts/content-types';
import {
  closeDraftEditStep,
  DRAFT_EDIT_HISTORY_LIMIT,
  type DraftEditHistory,
  FRESH_DRAFT_EDIT_HISTORY,
  recordDraftEdit,
  redoDraftEdit,
  undoDraftEdit,
} from '@libs/game-puzzle-shared-ts/draft-edit-history';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const START: ContentBody = {
  title: 'River',
  description: '',
  difficulty: '',
  definition: 'target:2',
};

type Command =
  | { readonly kind: 'edit'; readonly body: ContentBody }
  | { readonly kind: 'settle' | 'undo' | 'redo' };

const bodies = fc.record({
  title: fc.constantFrom('River', 'Valley', 'Harbor'),
  description: fc.constantFrom('', 'Gentle'),
  difficulty: fc.constant(''),
  definition: fc.constantFrom('target:2', 'target:3'),
});
const commands = fc.array(
  fc.oneof(
    bodies.map((body): Command => ({ kind: 'edit', body })),
    fc.constantFrom<Command>(
      { kind: 'settle' },
      { kind: 'undo' },
      { kind: 'redo' }
    )
  ),
  { maxLength: 40 }
);

type Session = {
  readonly history: DraftEditHistory;
  readonly body: ContentBody;
};

function edit(session: Session, body: ContentBody): Session {
  const history = recordDraftEdit(session.history, session.body, body);
  if (JSON.stringify(body) === JSON.stringify(session.body))
    expect(history).toBe(session.history);
  else expect(history.undone).toEqual([]);
  return { history, body };
}

function travel(session: Session, kind: 'undo' | 'redo'): Session {
  const [move, back] =
    kind === 'undo'
      ? [undoDraftEdit, redoDraftEdit]
      : [redoDraftEdit, undoDraftEdit];
  const moved = move(session.history, session.body);
  if (moved === null) {
    const choices =
      kind === 'undo' ? session.history.earlier : session.history.undone;
    expect(choices).toHaveLength(0);
    return session;
  }
  expect(back(moved.history, moved.body)?.body).toEqual(session.body);
  return moved;
}

function apply(session: Session, command: Command): Session {
  if (command.kind === 'edit') return edit(session, command.body);
  if (command.kind === 'settle')
    return { ...session, history: closeDraftEditStep(session.history) };
  return travel(session, command.kind);
}

test('undo and redo walk back and forth through saved bodies without losing one', () => {
  assertProperty(
    'draft edit history is reversible',
    fc.property(commands, (drawn) => {
      let session: Session = { history: FRESH_DRAFT_EDIT_HISTORY, body: START };
      for (const command of drawn) {
        session = apply(session, command);
        expect(session.history.earlier.length).toBeLessThanOrEqual(
          DRAFT_EDIT_HISTORY_LIMIT
        );
      }
    })
  );
});

test('typing in one field is one step until its save settles', () => {
  let history = FRESH_DRAFT_EDIT_HISTORY;
  let body = START;
  for (const title of ['V', 'Va', 'Val', 'Valley']) {
    history = recordDraftEdit(history, body, { ...body, title });
    body = { ...body, title };
  }
  expect(history.earlier).toEqual([START]);
  history = closeDraftEditStep(history);
  history = recordDraftEdit(history, body, { ...body, title: 'Harbor' });
  expect(history.earlier.map((entry) => entry.title)).toEqual([
    'River',
    'Valley',
  ]);
});
