import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { createSignal, type JSX, Show } from 'solid-js';

/** A command an operator can send one Synthetic User. */
export type SyntheticUserCommand = 'pause' | 'resume' | 'restart';

/**
 * The control panel's commands for one Synthetic User — pause, resume and
 * restart, three equal buttons in one padded panel — shown only to people
 * who may control it. Restart confirms first; each command reports its
 * outcome on its own button or in its dialog.
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
      <MenuSection
        title={<Trans>Control panel</Trans>}
        footer={
          <Trans>
            A paused Synthetic User finishes an ongoing game and starts nothing
            new until resumed.
          </Trans>
        }
      >
        <StackVertical padding="lg">
          <Grid columns={3} gap="sm">
            <Button
              {...pause.buttonProps}
              intent="neutral"
              variant="outline"
              fullWidth
              dataSet={{ testid: 'synthetic-population-pause' }}
            />
            <Button
              {...resume.buttonProps}
              intent="neutral"
              variant="outline"
              fullWidth
              dataSet={{ testid: 'synthetic-population-resume' }}
            />
            <Button
              title={t`Restart`}
              intent="neutral"
              variant="outline"
              fullWidth
              onClick={() => setRestart(true)}
              dataSet={{ testid: 'synthetic-population-restart' }}
            />
          </Grid>
        </StackVertical>
      </MenuSection>
      <MutationModal
        visible={restart()}
        onClose={() => setRestart(false)}
        title={t`Restart this Synthetic User?`}
        message={t`Its app closes and opens again. It keeps its account, its persona and any ongoing game, and carries on from its current activity.`}
        operation={() => props.command('restart')}
        submitLabel={t`Restart`}
        successTitle={t`Restart requested`}
        successBody={t`The Synthetic Population Worker reopens its app and it carries on where it was.`}
        submitDataSet={{ testid: 'synthetic-population-restart-confirm' }}
        successDataSet={{ testid: 'synthetic-population-restart-done' }}
        dismissDataSet={{ testid: 'synthetic-population-restart-dismiss' }}
      />
    </Show>
  );
}
