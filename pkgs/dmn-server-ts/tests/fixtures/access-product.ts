/**
 * A stand-in product for `access.dmn`, written independently of the table:
 * an application decision (`can`), a server operation that refuses what is
 * denied, and a client gate. The layers bind it the way a product package
 * binds its real code; the mutation tests break it the ways § 21 names.
 */

import type {
  DecisionInput,
  DecisionOutput,
} from '@pkgs/dmn-shared-ts/evaluate';
import type { DecisionLayer } from '@pkgs/dmn-shared-ts/registry';

export type Facts = {
  readonly tier: string;
  readonly capability: string;
  readonly playsToday: number;
};

export type Policy = { readonly dailyPlays: number };

export const SHIPPED: Policy = { dailyPlays: 20 };

export function can(policy: Policy, facts: Facts): DecisionOutput {
  if (facts.tier === 'plus') return { decision: 'allow', reason: 'none' };
  if (facts.capability === 'game.play') {
    return facts.playsToday < policy.dailyPlays
      ? { decision: 'allow', reason: 'none' }
      : { decision: 'deny', reason: 'limit reached' };
  }
  if (facts.tier === 'guest') {
    return { decision: 'deny', reason: 'requires account' };
  }
  return facts.capability === 'game.save'
    ? { decision: 'allow', reason: 'none' }
    : { decision: 'deny', reason: 'upgrade' };
}

/** The server runs the operation, or refuses it. */
export function serverOperation(policy: Policy, facts: Facts): 'done' {
  if (can(policy, facts)['decision'] !== 'allow') {
    throw new Error(`refused: ${facts.capability}`);
  }
  return 'done';
}

export function factsOf(input: DecisionInput): Facts {
  return {
    tier: String(input['tier']),
    capability: String(input['capability']),
    playsToday: Number(input['plays today']),
  };
}

export function applicationLayer(policy: Policy): DecisionLayer {
  return { decide: (input) => can(policy, factsOf(input)) };
}

/** Server enforcement: an operation that succeeds is an allow. */
export function serverLayer(
  operation: (facts: Facts) => 'done'
): DecisionLayer {
  return {
    observes: ['decision'],
    decide: (input) => {
      try {
        operation(factsOf(input));
        return { decision: 'allow' };
      } catch {
        return { decision: 'deny' };
      }
    },
  };
}

/** The client shows save and customize buttons enabled or locked. */
export function clientLayer(policy: Policy): DecisionLayer {
  return {
    observes: ['decision'],
    applies: (input) => input['capability'] !== 'game.play',
    decide: (input) => {
      const enabled = can(policy, factsOf(input))['decision'] === 'allow';
      return { decision: enabled ? 'allow' : 'deny' };
    },
  };
}
