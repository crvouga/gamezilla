import type { ProductHarnessSession } from '@pkgs/harness-console-shared/ports';
import { Button } from '@pkgs/ui-client/button';
import { EmptyState } from '@pkgs/ui-client/empty-state';
import { ScrollView } from '@pkgs/ui-client/scroll-view';
import { useMutationButton } from '@pkgs/ui-client/use-mutation-button';
import { For, Show } from 'solid-js';

/**
 * Runtime-registered server commands (seed, etc.). Faults live in the palette (⌘K).
 */
export function ProductHarnessCommandsPane(props: {
  readonly session: ProductHarnessSession;
}) {
  const commands = () => props.session.listCommands();

  return (
    <ScrollView class="flex-1 min-h-0" contentClass="p-[6px] gap-3">
      <p class="text textCaption text-text-secondary">
        {'Faults / partitions / skew / snapshots → command palette (⌘K).'}
      </p>
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
    <div class="box gap-1.5 p-[3px] border border-border rounded-md bg-surface">
      <p class="text text-text text-[13px] font-semibold">{props.label}</p>
      <p class="text textCaption text-text-secondary [font-family:mono]">
        {props.commandId}
      </p>
      <Button size="sm" {...mutation.buttonProps} />
    </div>
  );
}
