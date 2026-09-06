import { Box, Clickable, Collapsible, Text } from '@pkgs/ui';
import { For, type JSX, Show } from 'solid-js';

import type { SchemaIndex } from './use-schema-index';

export function SqlSchemaDrawer(props: {
  readonly schema: SchemaIndex;
  readonly onInsertTable: (table: string) => void;
  readonly onInsertColumn: (column: string) => void;
}): JSX.Element {
  const { schema, onInsertTable, onInsertColumn } = props;
  return (
    <Box
      sx={{
        borderTopWidth: 1,
        borderColor: 'outline',
        background: 'surface',
        maxHeight: 220,
        overflow: 'hidden',
      }}
    >
      <Collapsible title="Schema" defaultOpen={false}>
        <Box sx={{ px: 2, pb: 2, gap: 1, maxHeight: 180, overflow: 'scroll' }}>
          <Show when={schema.status() === 'loading'}>
            <Text
              sx={{ color: 'textSecondary', fontSize: 12 }}
              label="Loading schema…"
            />
          </Show>
          <Show when={schema.status() === 'error'}>
            <Text
              sx={{ color: 'destructive', fontSize: 12 }}
              label={schema.error() ?? 'Schema error'}
            />
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
            <Text
              sx={{ color: 'textSecondary', fontSize: 12 }}
              label="No tables yet."
            />
          </Show>
        </Box>
      </Collapsible>
    </Box>
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
    <Box sx={{ gap: 0.5 }}>
      <Clickable
        onClick={() => props.onInsertTable(props.name)}
        sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, py: 0.5 }}
      >
        <Text
          variant="mono"
          sx={{ fontSize: 12, color: 'tint', fontWeight: '600' }}
          label={props.name}
        />
        <Text
          sx={{ fontSize: 10, color: 'textSecondary' }}
          label={props.type}
        />
      </Clickable>
      <Box sx={{ pl: 3, gap: 0.5 }}>
        <For each={props.columns()}>
          {(col) => (
            <Clickable onClick={() => props.onInsertColumn(col)}>
              <Text
                variant="mono"
                sx={{ fontSize: 11, color: 'textSecondary' }}
                label={col}
              />
            </Clickable>
          )}
        </For>
      </Box>
    </Box>
  );
}
