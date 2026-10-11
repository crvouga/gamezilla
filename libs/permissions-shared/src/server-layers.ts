/**
 * The server enforcement layers this package can build whole: the access
 * table's (every capability a mutation performs, through the replay's
 * authorize hook, plus the routes a binding supplies) and the daily puzzle
 * limit's (the rated-puzzle consume, replayed with its ledger).
 *
 * For tests and spec bindings only (a `root/` export).
 */

import type { TableDef } from '@pkgs/db-schema-root-shared/define-table';
import type { DecisionLayer } from '@pkgs/dmn-shared/registry';
import type { MutationAuthorize } from '@pkgs/sync-engine-shared/mutations-types';
import { grantKeyOf } from './capabilities';
import { consumeQuotaMutation } from './consume-quota-mutation';
import { capabilityOf, identityFor, personOf } from './people';
import { ACTION } from './permission-catalog';
import { insertStarted, startedEntries } from './puzzle-ledger';
import { DAILY_PUZZLE_LIMIT_REASONS } from './reasons';
import type { ServerCase, ServerOperation } from './server';
import {
  allOperations,
  authorizeOperation,
  mutationsDeclaring,
  replayOperation,
  serverEnforcementLayer,
} from './server';
import type { AppPolicy } from './world';

export type AccessServerOptions = {
  /** Sub tables (billing's, and whatever the routes touch). */
  readonly tables: readonly TableDef[];
  /**
   * Capabilities performed through a route rather than a mutation, with the
   * route's operation (manifest id → operation).
   */
  readonly routes?: Readonly<Record<string, ServerOperation>>;
  /**
   * Capabilities this layer does not govern, each with why (no server
   * boundary exists, or another binding runs it). Any other capability
   * without a route or a mutation is an error: it would go unchecked.
   */
  readonly ungoverned?: Readonly<Record<string, string>>;
  /** Sub rows the routes need. */
  readonly seed?: (c: ServerCase) => Promise<void>;
  readonly policy?: AppPolicy;
  readonly guard?: MutationAuthorize;
};

/**
 * `access`, at the server: a capability a route performs runs that route; one
 * mutations perform runs the replay's authorize hook for every mutation
 * declaring its key (they must all agree); one declared ungoverned (with
 * why) is not; anything else throws.
 */
export function accessServerLayer(options: AccessServerOptions): DecisionLayer {
  return serverEnforcementLayer({
    tables: options.tables,
    ...(options.policy === undefined ? {} : { policy: options.policy }),
    ...(options.guard === undefined ? {} : { guard: options.guard }),
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    operationFor: (input) => {
      const capability = capabilityOf(input);
      if (options.ungoverned?.[capability] !== undefined) return null;
      const route = options.routes?.[capability];
      if (route !== undefined) return route;
      const names = mutationsDeclaring(grantKeyOf(capability));
      if (names.length === 0) {
        throw new Error(
          `conformance: "${capability}" has no route, no mutation and no reason it needs none`
        );
      }
      return allOperations(names.map(authorizeOperation));
    },
  });
}

/**
 * `daily-puzzle-limit`, at the server: the person's started puzzles in the
 * ledger, then one more rated puzzle consumed through the replay (the
 * authorize hook consumes with the server clock; the body is then a no-op).
 * A refusal's code is the product's reason, so the reason is observed too.
 */
export function dailyPuzzleLimitServerLayer(options: {
  readonly tables: readonly TableDef[];
  readonly policy?: AppPolicy;
  readonly guard?: MutationAuthorize;
}): DecisionLayer {
  const consume = replayOperation(consumeQuotaMutation, () => ({
    id: 'attempted-solve',
    quota: ACTION.puzzleRatedSolve,
    idempotencyKey: 'attempted-solve',
  }));
  return serverEnforcementLayer({
    ...options,
    reasons: DAILY_PUZZLE_LIMIT_REASONS,
    seed: (c) =>
      insertStarted(c.db, {
        ownerId: identityFor(personOf(c.input)).actorId,
        entries: startedEntries(c.input, c.nowMs),
      }),
    operationFor: () => consume,
  });
}
