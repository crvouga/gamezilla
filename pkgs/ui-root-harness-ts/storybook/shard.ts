/** Playwright numbers shards from one, including both endpoints. */
export function storybookShard(value: string) {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(value);
  if (!match || Number(match[1]) > Number(match[2]))
    throw new Error('STORYBOOK_SHARD must be a valid current/total pair');
  return { current: Number(match[1]), total: Number(match[2]) };
}
