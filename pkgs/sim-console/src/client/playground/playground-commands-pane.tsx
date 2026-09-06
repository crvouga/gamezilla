import {
  Box,
  Button,
  EmptyState,
  ScrollView,
  Text,
  useMutationButton,
} from '@pkgs/ui';
import { For, Show } from 'solid-js';

import type { PlaygroundSession } from '../../shared/ports';

/**
 * Runtime-registered server commands (seed, etc.). Faults live in the palette (⌘K).
 */
export function PlaygroundCommandsPane(props: {
  readonly session: PlaygroundSession;
}) {
  const commands = () => props.session.listCommands();

  return (
    <ScrollView frameSx={{ flex: 1, minHeight: 0 }} sx={{ padding: 6, gap: 3 }}>
      <Text
        variant="caption"
        label="Faults / partitions / skew / snapshots → command palette (⌘K)."
        sx={{ color: 'textSecondary' }}
      />
      <Show
        when={commands().length > 0}
        fallback={
          <EmptyState
            variant="compact"
            title="No host commands"
            body="Register playground commands from the host boot."
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
  readonly session: PlaygroundSession;
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
    <Box
      sx={{
        gap: 1.5,
        padding: 3,
        borderWidth: 1,
        borderColor: 'border',
        borderRadius: 'md',
        background: 'surface',
      }}
    >
      <Text
        sx={{ color: 'text', fontSize: 13, fontWeight: '600' }}
        label={props.label}
      />
      <Text
        variant="caption"
        label={props.commandId}
        sx={{ color: 'textSecondary', fontFamily: 'mono' }}
      />
      <Button size="sm" {...mutation.buttonProps} />
    </Box>
  );
}
