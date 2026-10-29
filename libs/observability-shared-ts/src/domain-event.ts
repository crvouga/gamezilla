import { technicalKey } from '@libs/product-identity-shared-ts/technical-names';
import { sha256 } from '@noble/hashes/sha2.js';
import type {
  EventContract,
  EventPayload,
} from '@pkgs/observability-root-shared-ts/event-contract';
import { createEventOutbox } from '@pkgs/observability-root-shared-ts/event-outbox';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';

/** `<namespace>:telemetry:v1:`; derived from the immutable namespace, so a
 * subject's pseudonym survives a rebrand. */
const TELEMETRY_SALT = `${technicalKey('telemetry', ':')}:v1:`;

/** Opaque account/install identifiers are pseudonymized before telemetry.
 * This is not anonymization; backend retention and erasure still apply. */
export function telemetrySubjectId(id: string): string {
  return [...sha256(new TextEncoder().encode(`${TELEMETRY_SALT}${id}`))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function createDomainEvent<const C extends EventContract>(contract: C) {
  const outbox = createEventOutbox(contract);
  return {
    contract,
    outbox,
    async record(
      ctx: MutationCtx,
      input: {
        readonly id: string;
        readonly attributes: EventPayload<C>;
      }
    ): Promise<void> {
      // Only authoritative replay emits; optimistic application is not a fact.
      if (ctx.env.serverNow === undefined) return;
      const attributes = { ...input.attributes };
      for (const [key, value] of Object.entries(attributes)) {
        if (key.endsWith('.id') && typeof value === 'string')
          Reflect.set(attributes, key, telemetrySubjectId(`${key}:${value}`));
      }
      await outbox.enqueue(ctx, {
        attributes,
        envelope: {
          id: telemetrySubjectId(`${contract.name}:${input.id}`),
          occurredAtMs: ctx.env.now().getTime(),
          ...(ctx.env.synthetic === undefined
            ? {}
            : { synthetic: ctx.env.synthetic }),
        },
      });
    },
  };
}
