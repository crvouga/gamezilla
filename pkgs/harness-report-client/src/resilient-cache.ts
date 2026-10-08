import type { ReportCache } from './fetcher';
import { memoryReportCache } from './fetcher';

/** Storage is an optimization. A denied or corrupt persistent cache cannot block reports. */
export function resilientReportCache(cache: ReportCache): ReportCache {
  const fallback = memoryReportCache();
  return {
    async get(key) {
      try {
        return (await cache.get(key)) ?? (await fallback.get(key));
      } catch {
        return fallback.get(key);
      }
    },
    async set(key, value) {
      await fallback.set(key, value);
      try {
        await cache.set(key, value);
      } catch {
        /* memory remains usable */
      }
    },
    async remove(key) {
      await fallback.remove(key);
      try {
        await cache.remove(key);
      } catch {
        /* optional persistent storage */
      }
    },
  };
}
