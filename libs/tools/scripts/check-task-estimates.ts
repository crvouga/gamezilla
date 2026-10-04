import type { CheckTask } from './check-shards';

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
function valid(seconds: number | undefined): seconds is number {
  return seconds !== undefined && Number.isFinite(seconds) && seconds > 0;
}

export function shardSummary(shard: {
  index: number;
  stage: string;
  seconds: number;
  tasks: readonly CheckTask[];
}): string {
  const hits = shard.tasks.filter((task) => task.hit).length;
  const heavy = [...shard.tasks]
    .sort((a, b) => b.seconds - a.seconds || (a.taskId < b.taskId ? -1 : 1))
    .slice(0, 5);
  return `${shard.stage} ${shard.index}: ${shard.tasks.length} tasks, ${shard.seconds.toFixed(1)} task-seconds; ${hits} hits, ${shard.tasks.length - hits} misses; ${shard.tasks.filter((task) => task.durationSource !== 'history').length} unknown\n  ${heavy.map((task) => `${task.taskId} ${task.seconds}s${task.hit ? ' (cached)' : ''}`).join('; ')}`;
}
