import type { NavPatch } from './router';
import { clearPlayerNav } from './router';

/** Nav patch when the bucket select changes (clears run + test). */
export function breadcrumbPatchForBucket(bucketId: string | null): NavPatch {
  return clearPlayerNav({ bucketId, runId: null });
}

/** Nav patch when the run select changes (clears test). */
export function breadcrumbPatchForRun(runId: string | null): NavPatch {
  return clearPlayerNav({ runId });
}

/** Nav patch when the test select changes. */
export function breadcrumbPatchForTest(testId: string | null): NavPatch {
  return clearPlayerNav({ testId });
}
