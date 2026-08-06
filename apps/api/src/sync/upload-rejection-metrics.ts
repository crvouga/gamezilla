import { createLogger } from '@pkgs/logger';

const log = createLogger({ name: 'api:mutation-reject' });

const counts = new Map<string, number>();

export function recordUploadRejection(code: string, appVersion: string): void {
  const key = `${code}:${appVersion}`;
  const next = (counts.get(key) ?? 0) + 1;
  counts.set(key, next);
  log.warn('mutation upload rejected', { code, appVersion, count: next });
}

export function recordMutationReplayMetric(args: {
  readonly mutationName: string;
  readonly status: 'applied' | 'rejected' | 'policy_violation';
  readonly code?: string;
  readonly latencyMs: number;
}): void {
  log.info('mutation replay', args);
}
