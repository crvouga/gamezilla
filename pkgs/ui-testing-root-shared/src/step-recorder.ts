import type { RecordStepMeta } from '@crvouga/atlas-reports/report-types';

/**
 * Where UI steps land. `Run.record` from `@pkgs/harness-root-shared` satisfies this; a
 * harness passes the run's recorder into {@link recordingDriver}.
 */
export type StepRecorder = {
  record<T>(meta: RecordStepMeta, fn: () => Promise<T>): Promise<T>;
};

/** Recorder that runs `fn` without recording (reporting disabled). */
export const NO_RECORDER: StepRecorder = {
  record: (_meta, fn) => fn(),
};
