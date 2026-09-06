import { Box, EmptyState, ScrollView, Text } from '@pkgs/ui';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';

import type {
  PlaygroundLogBuffer,
  PlaygroundLogEntry,
} from '../../shared/ports';

/**
 * Live reverse-chrono log list backed by a playground ring buffer.
 */
export function PlaygroundLogsPane(props: {
  readonly logs: PlaygroundLogBuffer;
}) {
  const [entries, setEntries] = createSignal(props.logs.snapshot());

  createEffect(() => {
    const logs = props.logs;
    setEntries(logs.snapshot());
    const unsub = logs.subscribe(() => setEntries(logs.snapshot()));
    onCleanup(unsub);
  });

  const newestFirst = () => [...entries()].reverse();

  return (
    <Show
      when={entries().length > 0}
      fallback={
        <Box sx={{ flex: 1, minHeight: 0, padding: 8 }}>
          <EmptyState
            variant="compact"
            title="No logs yet"
            body="HTTP traffic for this node will appear here."
          />
        </Box>
      }
    >
      <ScrollView
        frameSx={{ flex: 1, minHeight: 0 }}
        sx={{ padding: 6, gap: 1 }}
      >
        <For each={newestFirst()}>{(entry) => <LogRow entry={entry} />}</For>
      </ScrollView>
    </Show>
  );
}

function LogRow(props: { readonly entry: PlaygroundLogEntry }) {
  const { entry } = props;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        gap: 2,
        paddingVertical: 3,
        borderBottomWidth: 1,
        borderColor: 'border',
        alignItems: 'flex-start',
      }}
    >
      <Text
        sx={{
          color: levelColor(entry.level),
          fontSize: 10,
          fontWeight: '600',
          width: 40,
          flexShrink: 0,
        }}
      >
        {entry.level.toUpperCase()}
      </Text>
      <Text
        sx={{
          color: 'textSecondary',
          fontSize: 10,
          width: 72,
          flexShrink: 0,
        }}
      >
        {formatTime(entry.at)}
      </Text>
      <Text sx={{ color: 'text', fontSize: 11, flex: 1 }}>{entry.msg}</Text>
    </Box>
  );
}

function levelColor(
  level: PlaygroundLogEntry['level']
): 'textSecondary' | 'tint' | 'warning' | 'destructive' {
  if (level === 'error') return 'destructive';
  if (level === 'warn') return 'warning';
  if (level === 'info') return 'tint';
  return 'textSecondary';
}

function formatTime(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}
