import { Collapsible } from '@pkgs/ui-client/collapsible';
import { For, type JSX, Show } from 'solid-js';

import type { SchemaIndex } from './use-schema-index';

export function SqlSchemaDrawer(props: {
  readonly schema: SchemaIndex;
  readonly onInsertTable: (table: string) => void;
  readonly onInsertColumn: (column: string) => void;
}): JSX.Element {
  const { schema, onInsertTable, onInsertColumn } = props;
  return (
    <div class="box border-t border-outline bg-surface max-h-55 overflow-hidden">
      <Collapsible title="Schema" defaultOpen={false}>
        <div class="box px-2 pb-2 gap-1 max-h-45 overflow-scroll">
          <Show when={schema.status() === 'loading'}>
            <p class="text text-text-secondary text-xs">{'Loading schema…'}</p>
          </Show>
          <Show when={schema.status() === 'error'}>
            <p class="text text-destructive text-xs">
              {schema.error() ?? 'Schema error'}
            </p>
          </Show>
          <For each={schema.tables()}>
            {(t) => (
              <TableBlock
                name={t.name}
                type={t.type}
                columns={() => schema.columnsByTable()[t.name] ?? []}
                onInsertTable={onInsertTable}
                onInsertColumn={onInsertColumn}
              />
            )}
          </For>
          <Show
            when={schema.status() === 'ready' && schema.tables().length === 0}
          >
            <p class="text text-text-secondary text-xs">{'No tables yet.'}</p>
          </Show>
        </div>
      </Collapsible>
    </div>
  );
}

function TableBlock(props: {
  readonly name: string;
  readonly type: string;
  readonly columns: () => readonly string[];
  readonly onInsertTable: (table: string) => void;
  readonly onInsertColumn: (column: string) => void;
}): JSX.Element {
  return (
    <div class="box gap-0.5">
      <button
        class="clickable clickableTint flex-row items-center gap-2 py-0.5"
        type="button"
        onClick={() => props.onInsertTable(props.name)}
      >
        <code class="text textMono text-xs text-tint font-semibold">
          {props.name}
        </code>
        <p class="text text-micro text-text-secondary">{props.type}</p>
      </button>
      <div class="box pl-3 gap-0.5">
        <For each={props.columns()}>
          {(col) => (
            <button
              class="clickable clickableTint"
              type="button"
              onClick={() => props.onInsertColumn(col)}
            >
              <code class="text textMono text-[11px] text-text-secondary">
                {col}
              </code>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
