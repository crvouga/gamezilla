import type { SyntheticPopulationBulkCommand } from '@libs/synthetic-population-shared-ts/config';
import { Trans, useLingui } from '@lingui/solid/macro';
import { PauseIcon, PlayIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { createSignal, type JSX, Show } from 'solid-js';

/** A command for every Synthetic User at once. */
export type EveryCommand = SyntheticPopulationBulkCommand['command'];

/**
 * Pause or resume every Synthetic User at once, shown only to people who may
 * control them: one row per command in a panel, with what pausing does
 * under it. Each confirms first and reports its outcome in its dialog.
 */
export function EverySyntheticUserControls(props: {
  canControl: boolean;
  command: (value: EveryCommand) => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
  const [asking, setAsking] = createSignal<EveryCommand | null>(null);
  return (
    <Show when={props.canControl}>
      <MenuSection
        title={<Trans>Every Synthetic User</Trans>}
        footer={
          <Trans>
            Paused Synthetic Users finish an ongoing game and start nothing new
            until resumed.
          </Trans>
        }
      >
        <MenuRow
          leading={<PauseIcon size={20} color="icon" />}
          title={t`Pause every Synthetic User`}
          onClick={() => setAsking('pause-all')}
          dataSet={{ testid: 'synthetic-population-pause-all' }}
        />
        <MenuRow
          leading={<PlayIcon size={20} color="icon" />}
          title={t`Resume every Synthetic User`}
          onClick={() => setAsking('resume-all')}
          dataSet={{ testid: 'synthetic-population-resume-all' }}
        />
      </MenuSection>
      <MutationModal
        visible={asking() === 'pause-all'}
        onClose={() => setAsking(null)}
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
        visible={asking() === 'resume-all'}
        onClose={() => setAsking(null)}
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
