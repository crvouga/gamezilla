import type { ProductHarnessSession } from '@pkgs/harness-console-shared/ports';
import { Button } from '@pkgs/ui-root-client/button';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { Notice } from '@pkgs/ui-root-client/notice';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { Surface } from '@pkgs/ui-root-client/surface';
import { P } from '@pkgs/ui-root-client/text';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { For, Show } from 'solid-js';

/**
 * Runtime-registered server commands (seed, etc.). Faults live in the palette (⌘K).
 */
export function ProductHarnessCommandsPane(props: {
  readonly session: ProductHarnessSession;
}) {
  const commands = () => props.session.listCommands();

  return (
    <ScrollView grow padding="md" gap="md">
      <Notice>
        {
          'Faults, partitions, clock skew and snapshots live in the command palette (⌘K).'
        }
      </Notice>
      <Show
        when={commands().length > 0}
        fallback={
          <EmptyState
            variant="compact"
            title="No host commands"
            body="Register harness commands from the host boot."
          />
        }
      >
        <For each={commands()}>
          {(cmd) => (
            <CommandRow
              session={props.session}
              commandId={cmd.id}
              label={cmd.label}
            />
          )}
        </For>
      </Show>
    </ScrollView>
  );
}

function CommandRow(props: {
  readonly session: ProductHarnessSession;
  readonly commandId: string;
  readonly label: string;
}) {
  const mutation = useMutationButton({
    operation: async () => {
      await props.session.runCommand(props.commandId);
    },
    labels: {
      idle: 'Run',
      loading: 'Running…',
      success: 'Done',
      error: 'Failed',
    },
  });

  return (
    <Surface
      tone="surface"
      radius="control"
      border
      direction="horizontal"
      align="center"
      gap="md"
      padding="md"
    >
      <StackVertical grow gap="xs">
        <P variant="label" lines={1}>
          {props.label}
        </P>
        <P variant="mono" tone="secondary" lines={1}>
          {props.commandId}
        </P>
      </StackVertical>
      <Button size="sm" variant="outline" {...mutation.buttonProps} />
    </Surface>
  );
}
