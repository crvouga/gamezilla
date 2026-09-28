/**
 * The server enforcement layers this package can build whole: the access
 * table's (every capability a mutation performs, through the replay's
 * authorize hook, plus the routes a binding supplies) and the daily puzzle
 * limit's (the rated-puzzle consume, replayed with its ledger).
 *
 * For tests and spec bindings only (a `root/` export).
 */

import type { TableDef } from '@pkgs/db-schema';
import type { DecisionLayer } from '@pkgs/dmn/registry';
import type { MutationAuthorize } from '@pkgs/sync-engine/shared';

import { ACTION } from '../../shared/permission-catalog';
import { consumeQuotaMutation } from '../../use-cases/consume-quota/shared/consume-quota-mutation';
import { grantKeyOf } from './capabilities';
import { capabilityOf, identityFor, personOf } from './people';
import { insertSolved, solvedEntries } from './puzzle-ledger';
import { DAILY_PUZZLE_LIMIT_REASONS } from './reasons';
import {
  allOperations,
  authorizeOperation,
  mutationsDeclaring,
  replayOperation,
  type ServerCase,
  type ServerOperation,
  serverEnforcementLayer,
} from './server';
import type { AppPolicy } from './world';

export type AccessServerOptions = {
  /** Feature tables (billing's, and whatever the routes touch). */
  readonly tables: readonly TableDef[];
  /**
   * Capabilities performed through a route rather than a mutation, with the
   * route's operation (manifest id → operation).
   */
  readonly routes?: Readonly<Record<string, ServerOperation>>;
  /** Feature rows the routes need. */
  readonly seed?: (c: ServerCase) => Promise<void>;
  readonly policy?: AppPolicy;
  readonly guard?: MutationAuthorize;
};

/**
 * `access`, at the server: a capability a route performs runs that route; one
 * mutations perform runs the replay's authorize hook for every mutation
 * declaring its key (they must all agree); one with neither is not governed.
 */
export function accessServerLayer(options: AccessServerOptions): DecisionLayer {
  return serverEnforcementLayer({
    tables: options.tables,
    ...(options.policy === undefined ? {} : { policy: options.policy }),
    ...(options.guard === undefined ? {} : { guard: options.guard }),
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    operationFor: (input) => {
      const capability = capabilityOf(input);
      const route = options.routes?.[capability];
      if (route !== undefined) return route;
      const names = mutationsDeclaring(grantKeyOf(capability));
      return names.length === 0
        ? null
        : allOperations(names.map(authorizeOperation));
    },
  });
}

/**
 * `daily-puzzle-limit`, at the server: the person's solved puzzles in the
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
      insertSolved(c.db, {
        ownerId: identityFor(personOf(c.input)).actorId,
        entries: solvedEntries(c.input, c.nowMs),
      }),
    operationFor: () => consume,
  });
}
