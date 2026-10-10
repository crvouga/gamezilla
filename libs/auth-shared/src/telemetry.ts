import { createDomainEvent } from '@libs/observability-shared/domain-event';
import { defineEvent } from '@pkgs/observability-root-shared/event-contract';

export const accountProvisionedEvent = createDomainEvent(
  defineEvent({
    name: 'identity.account.provisioned',
    version: 1,
    owner: 'auth',
    description:
      'An account was first linked to a verified external identity; this is not completed onboarding.',
    delivery: 'reliable',
    attributes: { 'subject.id': { type: 'string', required: true } },
  })
);
export const AUTH_TELEMETRY = [accountProvisionedEvent] as const;
