import type { VerifyTask } from './verify-shards';

/** Task-family median transfers history across numbered spec leaves. */
export function estimateTask(
  taskId: string,
  costs: Readonly<Record<string, number>>
) {
  const exact = costs[taskId];
  if (valid(exact))
    return { seconds: exact, durationSource: 'history' as const };
  const family = (id: string) =>
    id.slice(id.indexOf('#') + 1).replace(/:\d+$/, '');
  const samples = Object.entries(costs)
    .filter(([id, seconds]) => family(id) === family(taskId) && valid(seconds))
    .map(([, seconds]) => seconds)
    .sort((a, b) => a - b);
  if (samples.length)
    return {
      seconds: samples[Math.floor(samples.length / 2)]!,
      durationSource: 'family' as const,
    };
  // Unknown work is real work: reserve a modest minute until it is measured.
  return { seconds: 60, durationSource: 'fallback' as const };
}
/**
 * The scheduler's estimate. A task with no sample of its own takes the median
 * of its own package's measured tasks in the family before the whole
 * family's: one suite's spec parts cost alike, and suites differ by an order
 * of magnitude, so the family median packs the heavy suite's parts as if
 * they were light.
 */
export function estimateScheduledTask(
  taskId: string,
  costs: Readonly<Record<string, number>>
) {
  if (valid(costs[taskId])) return estimateTask(taskId, costs);
  const owner = taskId.slice(0, taskId.indexOf('#') + 1);
  const siblings = Object.fromEntries(
    Object.entries(costs).filter(([id]) => id.startsWith(owner))
  );
  const sibling = estimateTask(taskId, siblings);
  return sibling.durationSource === 'family'
    ? sibling
    : estimateTask(taskId, costs);
}
function valid(seconds: number | undefined): seconds is number {
  return seconds !== undefined && Number.isFinite(seconds) && seconds > 0;
}

export function shardSummary(shard: {
  index: number;
  stage: string;
  seconds: number;
  tasks: readonly VerifyTask[];
}): string {
  const hits = shard.tasks.filter((task) => task.hit).length;
  const heavy = [...shard.tasks]
    .sort((a, b) => b.seconds - a.seconds || (a.taskId < b.taskId ? -1 : 1))
    .slice(0, 5);
  return `${shard.stage} ${shard.index}: ${shard.tasks.length} tasks, ${shard.seconds.toFixed(1)} task-seconds; ${hits} hits, ${shard.tasks.length - hits} misses; ${shard.tasks.filter((task) => task.durationSource !== 'history').length} unknown\n  ${heavy.map((task) => `${task.taskId} ${task.seconds}s${task.hit ? ' (cached)' : ''}`).join('; ')}`;
}
