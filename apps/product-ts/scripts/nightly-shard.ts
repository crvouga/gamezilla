/**
 * Which share of a nightly suite this runner holds. Verify Nightly spreads a
 * suite over a matrix of runners and names each one's place in
 * `NIGHTLY_SHARD=<k>/<n>` (1-based, as Playwright's `--shard`). Unset is the
 * whole suite, so `bun verify-nightly random` on a laptop runs everything.
 */

export const NIGHTLY_SHARD_ENV = 'NIGHTLY_SHARD';

/** The `index`-th (0-based) of `count` shares. */
export type NightlyShard = { readonly index: number; readonly count: number };

export const WHOLE_SUITE: NightlyShard = { index: 0, count: 1 };

export function nightlyShard(env: NodeJS.ProcessEnv): NightlyShard {
  const raw = env[NIGHTLY_SHARD_ENV]?.trim() ?? '';
  if (raw === '') return WHOLE_SUITE;
  const match = /^(\d+)\/(\d+)$/.exec(raw);
  const k = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (match === null || k < 1 || k > count)
    throw new Error(
      `${NIGHTLY_SHARD_ENV}=${raw} is not a shard: want <k>/<n> with 1 <= k <= n`
    );
  return { index: k - 1, count };
}

/** `k/n` as the workflow names it. */
export function formatShard(shard: NightlyShard): string {
  return `${String(shard.index + 1)}/${String(shard.count)}`;
}

/**
 * Every `count`-th item from the shard's own offset. Over all shards each
 * item lands exactly once, and neighbours in a sorted list (one package's
 * files) spread over every shard instead of loading one.
 */
export function shareOf<T>(items: readonly T[], shard: NightlyShard): T[] {
  return items.filter((_, position) => position % shard.count === shard.index);
}
