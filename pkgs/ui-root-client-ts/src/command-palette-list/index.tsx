/** @jsxImportSource solid-js */

import { createEffect, For, type JSX, on, Show } from 'solid-js';
import type { PaletteRow } from '../command-palette-filter';
import { CommandPaletteRow } from '../command-palette-row/index';
import { CommandPaletteSection } from '../command-palette-section/index';
import { ScrollView } from '../scroll-view/index';

export function commandPaletteRowId(
  listboxId: string,
  commandId: string
): string {
  return `${listboxId}-${commandId}`;
}

export type CommandPaletteListProps = {
  listboxId: string;
  rows: readonly PaletteRow[];
  /** Selected index within the item rows (headers excluded). */
  selectedIndex: number;
  query: string;
  runningId: string | null;
  getError: (id: string) => string | undefined;
  onSelectIndex: (index: number) => void;
  onActivate: (commandId: string) => void;
};

function scrollRowIntoView(host: HTMLElement | undefined, rowId: string): void {
  if (host === undefined) return;
  const el = host.querySelector<HTMLElement>(`#${CSS.escape(rowId)}`);
  if (el !== null && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Result list for {@link CommandPalette}: a scrollable `role="listbox"` of
 * section headers and {@link CommandPaletteRow}s. Keeps the keyboard-selected
 * row in view.
 */
export function CommandPaletteList(
  props: CommandPaletteListProps
): JSX.Element {
  let hostEl: HTMLElement | undefined;
  /** Item-row ordinal for each row (headers get -1). */
  const ordinals = (): number[] => {
    let n = 0;
    return props.rows.map((row) => (row.kind === 'item' ? n++ : -1));
  };
  const selectedCommandId = (): string | undefined => {
    const row = props.rows.filter((r) => r.kind === 'item')[
      props.selectedIndex
    ];
    return row?.kind === 'item' ? row.command.id : undefined;
  };
  createEffect(
    on(selectedCommandId, (id) => {
      if (id !== undefined) {
        scrollRowIntoView(hostEl, commandPaletteRowId(props.listboxId, id));
      }
    })
  );
  return (
    <ScrollView maxHeight="md">
      <div
        class="box"
        data-component="CommandPaletteList"
        ref={(el) => {
          hostEl = el;
        }}
        id={props.listboxId}
        role="listbox"
      >
        <For each={props.rows}>
          {(row, index) => (
            <Show
              when={row.kind === 'item' ? row : undefined}
              fallback={
                <CommandPaletteSection
                  title={row.kind === 'header' ? row.title : ''}
                />
              }
            >
              {(item) => (
                <CommandPaletteRow
                  id={commandPaletteRowId(props.listboxId, item().command.id)}
                  command={item().command}
                  query={props.query}
                  selected={ordinals()[index()] === props.selectedIndex}
                  running={props.runningId === item().command.id}
                  error={props.getError(item().command.id)}
                  onSelect={() => props.onActivate(item().command.id)}
                  onHover={() => props.onSelectIndex(ordinals()[index()] ?? 0)}
                />
              )}
            </Show>
          )}
        </For>
      </div>
    </ScrollView>
  );
}
