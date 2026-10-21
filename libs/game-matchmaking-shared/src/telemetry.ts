import {
  createDomainEvent,
  telemetrySubjectId,
} from '@libs/observability-shared/domain-event';
import { defineEvent } from '@pkgs/observability-root-shared/event-contract';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import type { MultiplayerGame } from './game-state';

const attributes = {
  'game.time_control': { type: 'string' },
  'participant.white.id': { type: 'string', required: true },
  'participant.black.id': { type: 'string', required: true },
  'game.id': { type: 'string', required: true },
  'game.mode': { type: 'string', required: true, values: ['multiplayer'] },
} as const;
export const gameCreatedEvent = createDomainEvent(
  defineEvent({
    name: 'chess.game.created',
    version: 1,
    owner: 'game-session',
    description: 'A multiplayer game was created.',
    delivery: 'reliable',
    attributes,
  })
);
export const gameStartedEvent = createDomainEvent(
  defineEvent({
    name: 'chess.game.started',
    version: 1,
    owner: 'game-session',
    description: 'Both people made their first move.',
    delivery: 'reliable',
    attributes,
  })
);
export const gameCompletedEvent = createDomainEvent(
  defineEvent({
    name: 'chess.game.completed',
    version: 1,
    owner: 'game-session',
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
    owner: 'game-session',
    description: 'A multiplayer game ended without a result.',
    delivery: 'reliable',
    attributes,
  })
);
/**
 * A side of a game with private setups chose its setup. It says which
 * sides are ready, never a setup: the team sees a setup phase progress or
 * stall without learning anyone's arrangement.
 */
const SETUP_READINESS = ['white', 'black', 'white,black'] as const;
export const gameSetupReadyEvent = createDomainEvent(
  defineEvent({
    name: 'chess.setup.chosen',
    version: 1,
    owner: 'game-session',
    description: 'A side of a multiplayer game chose its private setup.',
    delivery: 'reliable',
    attributes: {
      ...attributes,
      'game.setup_ready': {
        type: 'string',
        required: true,
        values: SETUP_READINESS,
      },
    },
  })
);
export const MULTIPLAYER_TELEMETRY = [
  gameCreatedEvent,
  gameSetupReadyEvent,
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
    ...(after.time_control === null
      ? {}
      : { 'game.time_control': after.time_control }),
  } as const;
  const ready = SETUP_READINESS.find((sides) => sides === after.setup_ready);
  if (ready !== undefined && before.setup_ready !== after.setup_ready)
    await gameSetupReadyEvent.outbox.enqueue(ctx, {
      envelope: { ...envelope, id: `${after.id}:${ready}` },
      attributes: { ...attributes, 'game.setup_ready': ready },
    });
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
