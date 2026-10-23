import type { MetricContract } from './metric-contract';
import { createMetric } from './metric-contract';

/**
 * What became of one server replay of a queued client write.
 *
 * - `applied`: it changed the data.
 * - `duplicate`: it had already been decided, and the earlier verdict stands.
 * - `rejected`: the rules refused it for good (the person asked for something
 *   the product does not allow). The server did its job.
 * - `failed`: the server could not decide (a database or infrastructure
 *   error); the write is retried. This is the server's failure, never the
 *   person's.
 */
export const MUTATION_REPLAY_OUTCOMES = [
  'applied',
  'duplicate',
  'rejected',
  'failed',
] as const;
export type MutationReplayOutcome = (typeof MUTATION_REPLAY_OUTCOMES)[number];

export const MUTATION_REPLAYS_METRIC: MetricContract = {
  name: 'sync.mutation.replays',
  description: 'Server replays of queued client writes, by outcome',
  type: 'counter',
  unit: '{replay}',
  dimensions: { 'app.mutation.outcome': MUTATION_REPLAY_OUTCOMES },
};

export function createMutationReplayMetric(): (
  outcome: MutationReplayOutcome
) => void {
  const count = createMetric(MUTATION_REPLAYS_METRIC);
  return (outcome) => {
    count(1, { 'app.mutation.outcome': outcome });
  };
}
