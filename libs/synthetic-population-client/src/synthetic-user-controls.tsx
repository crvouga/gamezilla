import { useCan } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { createSignal, type JSX, Show } from 'solid-js';

export function SyntheticUserControls(props: {
  command: (value: 'pause' | 'resume' | 'restart') => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
  const control = useCan(PERMISSION.syntheticPopulationControl);
  const [restart, setRestart] = createSignal(false);
  const pause = useMutationButton({
    labels: { idle: t`Pause`, success: t`Paused`, error: t`Try again` },
    operation: () => props.command('pause'),
  });
  const resume = useMutationButton({
    labels: { idle: t`Resume`, success: t`Resumed`, error: t`Try again` },
    operation: () => props.command('resume'),
  });
  return (
    <Show when={control()}>
      <div class="box flex-row flex-wrap gap-3">
        <Button
          {...pause.buttonProps}
          dataSet={{ testid: 'synthetic-population-pause' }}
        />
        <Button
          {...resume.buttonProps}
          dataSet={{ testid: 'synthetic-population-resume' }}
        />
        <Button
          title={t`Restart application`}
          onClick={() => setRestart(true)}
          dataSet={{ testid: 'synthetic-population-restart' }}
        />
      </div>
      <MutationModal
        visible={restart()}
        onClose={() => setRestart(false)}
        title={t`Restart this Synthetic User?`}
        message={t`Its application reconnects and reconciles its ongoing activity before taking another action.`}
        operation={() => props.command('restart')}
        submitLabel={t`Restart`}
        successTitle={t`Restart requested`}
        successBody={t`The Synthetic Population Worker will recover this application.`}
      />
    </Show>
  );
}
