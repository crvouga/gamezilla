import type { CheckTask } from './check-shards';

/** Reasons describe what was observed, not guesses about why an old key differs. */
export function cacheDiagnostics(
  tasks: readonly CheckTask[],
  responses: Readonly<Record<string, number>>
) {
  return tasks
    .filter((task) => !task.hit)
    .map((task) => {
      const status = responses[task.hash];
      const reason =
        task.cacheable === false
          ? 'task explicitly disables caching'
          : status === 404
            ? 'exact artifact absent (HTTP 404); compare prior plan hash/inputs, check successful upload and retention'
            : status === 0
              ? 'remote lookup failed or timed out; verify cache service connectivity'
              : status !== undefined
                ? `remote HTTP ${status}; verify cache service/authentication`
                : 'local artifact absent; remote lookup not performed (cold mode or no credentials)';
      return { taskId: task.taskId, hash: task.hash, reason };
    });
}
