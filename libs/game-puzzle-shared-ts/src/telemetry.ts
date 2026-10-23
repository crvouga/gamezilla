import { createDomainEvent } from '@libs/observability-shared-ts/domain-event';
import { defineEvent } from '@pkgs/observability-root-shared-ts/event-contract';

const attributes = {
  'puzzle.id': { type: 'string', required: true },
  'subject.id': { type: 'string', required: true },
} as const;
export const puzzleAttemptedEvent = createDomainEvent(
  defineEvent({
    name: 'chess.puzzle.attempted',
    version: 1,
    owner: 'chess-puzzle',
    description: 'A person started a puzzle attempt.',
    delivery: 'reliable',
    attributes,
  })
);
export const puzzleCompletedEvent = createDomainEvent(
  defineEvent({
    name: 'chess.puzzle.completed',
    version: 1,
    owner: 'chess-puzzle',
    description: 'A person solved a puzzle.',
    delivery: 'reliable',
    attributes,
  })
);
export const PUZZLE_TELEMETRY = [
  puzzleAttemptedEvent,
  puzzleCompletedEvent,
] as const;
