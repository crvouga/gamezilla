import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, For, type JSX, Show } from 'solid-js';

/** A command an operator can send one Synthetic User. */
export type SyntheticUserCommand = 'pause' | 'resume' | 'restart';

type CommandCopy = {
  readonly button: string;
  readonly title: string;
  readonly message: string;
  readonly submit: string;
  readonly success: string;
  readonly successBody?: string | undefined;
};

function useCommandCopy(): (command: SyntheticUserCommand) => CommandCopy {
  const { t } = useLingui();
  const copy: Record<SyntheticUserCommand, () => CommandCopy> = {
    pause: () => ({
      button: t`Pause`,
      title: t`Pause this Synthetic User?`,
      message: t`It finishes an ongoing game, then starts nothing new until resumed.`,
      submit: t`Pause`,
      success: t`Paused`,
    }),
    resume: () => ({
      button: t`Resume`,
      title: t`Resume this Synthetic User?`,
      message: t`It starts its activities again.`,
      submit: t`Resume`,
      success: t`Resumed`,
    }),
    restart: () => ({
      button: t`Restart`,
      title: t`Restart this Synthetic User?`,
      message: t`Its app closes and opens again. It keeps its account, its persona and any ongoing game, and carries on from its current activity.`,
      submit: t`Restart`,
      success: t`Restart requested`,
      successBody: t`The Synthetic Population Worker reopens its app and it carries on where it was.`,
    }),
  };
  return (command) => copy[command]();
}

const COMMANDS: readonly SyntheticUserCommand[] = [
  'pause',
  'resume',
  'restart',
];

/**
 * The control panel's commands for one Synthetic User — pause, resume and
 * restart, three equal buttons in one padded panel — shown only to people
 * who may control it. Each confirms first and reports its outcome in its
 * dialog.
 */
export function SyntheticUserControls(props: {
  canControl: boolean;
  command: (value: SyntheticUserCommand) => Promise<void>;
}): JSX.Element {
  const copy = useCommandCopy();
  const [asking, setAsking] = createSignal<SyntheticUserCommand | null>(null);
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
            <For each={COMMANDS}>
              {(command) => (
                <Button
                  title={copy(command).button}
                  intent="neutral"
                  variant="outline"
                  fullWidth
                  onClick={() => setAsking(command)}
                  dataSet={{ testid: `synthetic-population-${command}` }}
                />
              )}
            </For>
          </Grid>
        </StackVertical>
      </MenuSection>
      <For each={COMMANDS}>
        {(command) => (
          <MutationModal
            visible={asking() === command}
            onClose={() => setAsking(null)}
            title={copy(command).title}
            message={copy(command).message}
            operation={() => props.command(command)}
            submitLabel={copy(command).submit}
            successTitle={copy(command).success}
            successBody={copy(command).successBody}
            submitDataSet={{
              testid: `synthetic-population-${command}-confirm`,
            }}
            successDataSet={{ testid: `synthetic-population-${command}-done` }}
            dismissDataSet={{
              testid: `synthetic-population-${command}-dismiss`,
            }}
          />
        )}
      </For>
    </Show>
  );
}
