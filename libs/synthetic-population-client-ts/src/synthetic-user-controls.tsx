import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { createSignal, type JSX, Show } from 'solid-js';

/** A command an operator can send one Synthetic User. */
export type SyntheticUserCommand = 'pause' | 'resume' | 'restart';

/**
 * Pause, resume and restart for one Synthetic User, shown only to people who
 * may control it. Restart confirms first; each command reports its outcome.
 */
export function SyntheticUserControls(props: {
  canControl: boolean;
  command: (value: SyntheticUserCommand) => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
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
    <Show when={props.canControl}>
      <StackHorizontal wrap gap="md">
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
      </StackHorizontal>
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
