import { createLogger } from '@pkgs/logger';

const log = createLogger({ name: 'api:sync-upload-reject' });

const counts = new Map<string, number>();

export function recordUploadRejection(code: string, appVersion: string): void {
  const key = `${code}:${appVersion}`;
  const next = (counts.get(key) ?? 0) + 1;
  counts.set(key, next);
  log.warn('sync upload rejected', { code, appVersion, count: next });
}
