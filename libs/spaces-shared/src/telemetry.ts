import { createDomainEvent } from '@libs/observability-shared/domain-event';
import { defineEvent } from '@pkgs/observability-root-shared/event-contract';

const attributes = {
  'space.id': { type: 'string', required: true },
  'subject.id': { type: 'string', required: true },
} as const;

export const spaceCreatedEvent = createDomainEvent(
  defineEvent({
    name: 'multiplayer.space.created',
    version: 1,
    owner: 'spaces',
    description: 'A person created a space.',
    delivery: 'reliable',
    attributes,
  })
);
export const playerJoinedEvent = createDomainEvent(
  defineEvent({
    name: 'multiplayer.player.joined',
    version: 1,
    owner: 'spaces',
    description: 'A person joined a space.',
    delivery: 'reliable',
    attributes,
  })
);
export const playerLeftEvent = createDomainEvent(
  defineEvent({
    name: 'multiplayer.player.left',
    version: 1,
    owner: 'spaces',
    description: 'A person left a space.',
    delivery: 'reliable',
    attributes,
  })
);

export const SPACE_TELEMETRY = [
  spaceCreatedEvent,
  playerJoinedEvent,
  playerLeftEvent,
] as const;
