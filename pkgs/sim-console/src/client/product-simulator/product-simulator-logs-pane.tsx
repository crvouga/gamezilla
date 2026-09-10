import { EmptyState, ScrollView } from '@pkgs/ui';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';

import type {
  ProductSimulatorLogBuffer,
  ProductSimulatorLogEntry,
} from '../../shared/ports';

/**
 * Live reverse-chrono log list backed by a product-simulator ring buffer.
 */
export function ProductSimulatorLogsPane(props: {
  readonly logs: ProductSimulatorLogBuffer;
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
        <div class="box flex-1 min-h-[0] p-[8px] bg-background">
          <EmptyState
            variant="compact"
            title="No logs yet"
            body="HTTP traffic for this node will appear here."
          />
        </div>
      }
    >
      <ScrollView
        class="flex-1 min-h-[0] bg-background"
        contentClass="p-[6px] gap-1"
      >
        <For each={newestFirst()}>{(entry) => <LogRow entry={entry} />}</For>
      </ScrollView>
    </Show>
  );
}

function LogRow(props: { readonly entry: ProductSimulatorLogEntry }) {
  const { entry } = props;
  const levelClass = (): string => {
    if (entry.level === 'error') return 'text-destructive';
    if (entry.level === 'warn') return 'text-warning';
    if (entry.level === 'info') return 'text-tint';
    return 'text-text-secondary';
  };
  return (
    <div class="box flex-row gap-2 [padding-top:3px;padding-bottom:3px] border-b border-border items-start">
      <p
        class={`text text-[10px] font-semibold w-[40px] shrink-0 ${levelClass()}`}
      >
        {entry.level.toUpperCase()}
      </p>
      <p class="text text-text-secondary text-[10px] w-[72px] shrink-0">
        {formatTime(entry.at)}
      </p>
      <p class="text text-text text-[11px] flex-1">{entry.msg}</p>
    </div>
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
