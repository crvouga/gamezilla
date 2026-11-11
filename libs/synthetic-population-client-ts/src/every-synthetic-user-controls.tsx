import { DenialModalView } from '@libs/permissions-client-ts/denial-modal-view';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import type { SyntheticPopulationBulkCommand } from '@libs/synthetic-population-shared-ts/config';
import { useLingui } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { type JSX, Show } from 'solid-js';

/** A command for every Synthetic User at once. */
export type EveryCommand = SyntheticPopulationBulkCommand['command'];

/**
 * The surfaces behind "Pause every" / "Resume every": for a person who may
 * control, a confirmation that reports its outcome in place; for anyone
 * else, the reason they may not. `asking` is the command just pressed.
 */
export function EverySyntheticUserDialogs(props: {
  asking: EveryCommand | null;
  onClose: () => void;
  canControl: boolean;
  /** Why a person who may not control is refused. */
  denial: DenialView | undefined;
  command: (value: EveryCommand) => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Show
      when={props.canControl}
      fallback={
        <Show when={props.denial}>
          {(denial) => (
            <DenialModalView
              denial={denial()}
              visible={props.asking !== null}
              onDismiss={() => props.onClose()}
            />
          )}
        </Show>
      }
    >
      <MutationModal
        visible={props.asking === 'pause-all'}
        onClose={() => props.onClose()}
        title={t`Pause every Synthetic User?`}
        message={t`Each one finishes its ongoing game, then starts nothing new until resumed.`}
        operation={() => props.command('pause-all')}
        submitLabel={t`Pause all`}
        successTitle={t`Every Synthetic User is paused`}
        submitDataSet={{ testid: 'synthetic-population-pause-all-confirm' }}
        successDataSet={{ testid: 'synthetic-population-every-done' }}
        dismissDataSet={{ testid: 'synthetic-population-every-dismiss' }}
      />
      <MutationModal
        visible={props.asking === 'resume-all'}
        onClose={() => props.onClose()}
        title={t`Resume every Synthetic User?`}
        message={t`Each one starts its activities again.`}
        operation={() => props.command('resume-all')}
        submitLabel={t`Resume all`}
        successTitle={t`Every Synthetic User is resumed`}
        submitDataSet={{ testid: 'synthetic-population-resume-all-confirm' }}
        successDataSet={{ testid: 'synthetic-population-every-done' }}
        dismissDataSet={{ testid: 'synthetic-population-every-dismiss' }}
      />
    </Show>
  );
}
