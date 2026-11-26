/** Playwright numbers shards from one, including both endpoints. */
export function storybookShard(value: string) {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(value);
  const current = Number(match?.[1]);
  const total = Number(match?.[2]);
  if (!Number.isSafeInteger(total) || current > total)
    throw new Error('STORYBOOK_SHARD must be a valid current/total pair');
  return { current, total };
}
