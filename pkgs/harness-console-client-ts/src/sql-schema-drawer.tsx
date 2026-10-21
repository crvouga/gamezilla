import { Collapsible } from '@pkgs/ui-root-client-ts/collapsible';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { Toolbar } from '@pkgs/ui-root-client-ts/toolbar';
import { For, type JSX, Match, Switch } from 'solid-js';

import type { SchemaIndex } from './use-schema-index';

/** Collapsible table / column list under the notebook; a press inserts. */
export function SqlSchemaDrawer(props: {
  readonly schema: SchemaIndex;
  readonly onInsertTable: (table: string) => void;
  readonly onInsertColumn: (column: string) => void;
}): JSX.Element {
  return (
    <Toolbar edge="top" tone="surface" aria-label="Schema">
      <StackVertical grow>
        <Collapsible title="Schema" defaultOpen={false}>
          <ScrollView maxHeight="sm" gap="sm" paddingEnd="sm">
            <Switch>
              <Match when={props.schema.status() === 'loading'}>
                <LoadingState variant="compact" caption="Loading schema…" />
              </Match>
              <Match when={props.schema.status() === 'error'}>
                <Notice tone="error">
                  {props.schema.error() ?? 'Schema error'}
                </Notice>
              </Match>
              <Match
                when={
                  props.schema.status() === 'ready' &&
                  props.schema.tables().length === 0
                }
              >
                <P variant="caption">{'No tables yet.'}</P>
              </Match>
            </Switch>
            <For each={props.schema.tables()}>
              {(t) => (
                <TableBlock
                  name={t.name}
                  type={t.type}
                  columns={() => props.schema.columnsByTable()[t.name] ?? []}
                  onInsertTable={props.onInsertTable}
                  onInsertColumn={props.onInsertColumn}
                />
              )}
            </For>
          </ScrollView>
        </Collapsible>
      </StackVertical>
    </Toolbar>
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
    <StackVertical gap="xs">
      <Pressable
        direction="horizontal"
        align="center"
        gap="sm"
        radius="sm"
        aria-label={`Insert query for ${props.name}`}
        onPress={() => props.onInsertTable(props.name)}
      >
        <Text variant="mono" tone="tint">
          {props.name}
        </Text>
        <Text variant="footnote">{props.type}</Text>
      </Pressable>
      <StackVertical paddingStart="md" gap="xs">
        <For each={props.columns()}>
          {(col) => (
            <Pressable
              radius="sm"
              self="start"
              aria-label={`Insert column ${col}`}
              onPress={() => props.onInsertColumn(col)}
            >
              <Text variant="mono" tone="secondary">
                {col}
              </Text>
            </Pressable>
          )}
        </For>
      </StackVertical>
    </StackVertical>
  );
}
