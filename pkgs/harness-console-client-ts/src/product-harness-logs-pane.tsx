import type { ProductHarnessLogBuffer } from '@pkgs/harness-console-shared-ts/ports';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { LogLine } from '@pkgs/ui-root-client-ts/log-line';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';

/**
 * Live reverse-chrono log list backed by a product-harness ring buffer.
 */
export function ProductHarnessLogsPane(props: {
  readonly logs: ProductHarnessLogBuffer;
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
        <StackVertical grow padding="sm">
          <EmptyState
            variant="compact"
            title="No logs yet"
            body="HTTP traffic for this node will appear here."
          />
        </StackVertical>
      }
    >
      <ScrollView grow tone="background" paddingX="sm">
        <For each={newestFirst()}>
          {(entry) => (
            <LogLine
              level={entry.level}
              time={formatTime(entry.at)}
              message={entry.msg}
            />
          )}
        </For>
      </ScrollView>
    </Show>
  );
}

function formatTime(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}
