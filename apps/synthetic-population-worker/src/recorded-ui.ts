import type { Inspection } from '@libs/synthetic-population-shared/inspection';
import { redactDiagnostic } from '@libs/synthetic-population-shared/inspection';
import type { Clock } from '@pkgs/clock-shared/types';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import { recordingDriver } from '@pkgs/ui-testing-root-shared/recording-driver';

export type RecordingInput = {
  /** Sign-in links and session tokens seen so far; never recorded or reported. */
  secrets: () => readonly string[];
  onAction: (action: Inspection['actions'][number]) => void;
  onError: (message: string) => void;
};

export function recordedUi(
  driver: Driver,
  clock: Clock,
  input: RecordingInput
) {
  return recordingDriver(driver, {
    recorder: {
      async record(meta, run) {
        // Input text and full report snapshots may contain a sign-in link.
        const action =
          `${meta.selector ?? ''}: ${meta.title.split(' ')[0] ?? 'action'}`.slice(
            0,
            256
          );
        const report = (outcome: Inspection['actions'][number]['outcome']) =>
          input.onAction({ action, atMs: clock.now(), outcome });
        report('started');
        try {
          const value = await run();
          report('completed');
          return value;
        } catch (error) {
          input.onError(
            redactDiagnostic(
              error instanceof Error ? error.message : String(error),
              input.secrets()
            ).slice(0, 512)
          );
          report('failed');
          throw error;
        }
      },
    },
  });
}
