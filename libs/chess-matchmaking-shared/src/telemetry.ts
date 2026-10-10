import {
  createDomainEvent,
  telemetrySubjectId,
} from '@libs/observability-shared/domain-event';
import { defineEvent } from '@pkgs/observability-root-shared/event-contract';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import type { MultiplayerGame } from './game-state';

const attributes = {
  'participant.white.id': { type: 'string', required: true },
  'participant.black.id': { type: 'string', required: true },
  'game.id': { type: 'string', required: true },
  'game.mode': { type: 'string', required: true, values: ['multiplayer'] },
} as const;
export const gameCreatedEvent = createDomainEvent(
  defineEvent({
    name: 'chess.game.created',
    version: 1,
    owner: 'chess-matchmaking',
    description: 'A multiplayer game was created.',
    delivery: 'reliable',
    attributes,
  })
);
export const gameStartedEvent = createDomainEvent(
  defineEvent({
    name: 'chess.game.started',
    version: 1,
    owner: 'chess-matchmaking',
    description: 'Both people made their first move.',
    delivery: 'reliable',
    attributes,
  })
);
export const gameCompletedEvent = createDomainEvent(
  defineEvent({
    name: 'chess.game.completed',
    version: 1,
    owner: 'chess-matchmaking',
    description: 'A multiplayer game reached a win or draw.',
    delivery: 'reliable',
    attributes: {
      ...attributes,
      'game.outcome': {
        type: 'string',
        required: true,
        values: ['white', 'black', 'draw'],
      },
    },
  })
);
export const gameAbortedEvent = createDomainEvent(
  defineEvent({
    name: 'chess.game.aborted',
    version: 1,
    owner: 'chess-matchmaking',
    description: 'A multiplayer game ended without a result.',
    delivery: 'reliable',
    attributes,
  })
);
export const MULTIPLAYER_TELEMETRY = [
  gameCreatedEvent,
  gameStartedEvent,
  gameCompletedEvent,
  gameAbortedEvent,
] as const;

export async function recordGameTransition(
  tx: SqlTx,
  input: {
    readonly before: MultiplayerGame;
    readonly after: MultiplayerGame;
    readonly nowMs: number;
    readonly synthetic?: boolean;
  }
): Promise<void> {
  const { before, after, nowMs } = input;
  const ctx = {
    tx,
    env: { now: () => new Date(nowMs), createId: () => after.id },
  };
  const envelope = {
    id: after.id,
    occurredAtMs: nowMs,
    ...(input.synthetic === undefined ? {} : { synthetic: input.synthetic }),
  };
  const attributes = {
    'participant.white.id': telemetrySubjectId(`subject.id:${after.white_id}`),
    'participant.black.id': telemetrySubjectId(`subject.id:${after.black_id}`),
    'game.id': after.id,
    'game.mode': 'multiplayer',
  } as const;
  if (before.revision < 2 && after.revision >= 2)
    await gameStartedEvent.outbox.enqueue(ctx, { envelope, attributes });
  if (before.outcome !== 'ongoing' || after.outcome === 'ongoing') return;
  if (after.outcome === 'aborted')
    await gameAbortedEvent.outbox.enqueue(ctx, { envelope, attributes });
  else
    await gameCompletedEvent.outbox.enqueue(ctx, {
      envelope,
      attributes: { ...attributes, 'game.outcome': after.outcome },
    });
}
