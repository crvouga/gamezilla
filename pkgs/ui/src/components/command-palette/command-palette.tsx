/** @jsxImportSource solid-js */
/**
 * `CommandPalette` -- ⌘K-style dialog listing registered commands.
 *
 * Built on {@link ModalRoot} (surface stack + focus trap + Escape). The card
 * sits near the top of the viewport; clicking the scrim closes. Rows come
 * from {@link buildPaletteRows} (fuzzy search, or Recent + categories), and
 * Arrow / Home / End / Tab move the selection while Enter runs it.
 */

import { useLingui } from '@lingui/solid/macro';
import {
  createEffect,
  createMemo,
  createUniqueId,
  type JSX,
  on,
  Show,
  untrack,
} from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { MODAL_CONTENT_MARGIN_STEP } from '../../theme/modal-size';
import { ModalContent } from '../modal/modal-content';
import { ModalRoot } from '../modal/modal-root';
import { ProgressBar } from '../progress-bar';
import { CommandPaletteEmpty } from './command-palette-empty';
import {
  buildPaletteRows,
  type PaletteItemRow,
  type PaletteRows,
  selectableRows,
} from './command-palette-filter';
import { CommandPaletteHint } from './command-palette-hint';
import { CommandPaletteInput } from './command-palette-input';
import {
  clampPaletteSelection,
  nextPaletteSelection,
} from './command-palette-keyboard';
import {
  CommandPaletteList,
  commandPaletteRowId,
} from './command-palette-list';
import {
  type CommandRegistryContextValue,
  useCommandRegistry,
} from './command-registry-context';

const TOP_INSET_STEP = 12;

export type CommandPaletteProps = {
  /** Hint shown under the list (e.g. keyboard shortcuts). */
  footerLegend?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

type PaletteModel = {
  rows: () => PaletteRows;
  items: () => PaletteItemRow[];
  activeId: () => string | undefined;
  onKeyDown: (ev: KeyboardEvent) => void;
};

function createPaletteModel(
  reg: CommandRegistryContextValue,
  listboxId: string
): PaletteModel {
  const rows = createMemo(() =>
    buildPaletteRows(reg.commands(), reg.query(), reg.historyIds())
  );
  const items = createMemo(() => selectableRows(rows().rows));
  // Reset selection when the query changes; clamp when the row set shrinks.
  createEffect(on(reg.query, () => reg.setSelectedIndex(0), { defer: true }));
  createEffect(
    on(
      () => rows().selectableCount,
      (count) => {
        reg.setSelectedIndex((prev) => clampPaletteSelection(prev, count));
      }
    )
  );
  const activeId = (): string | undefined => {
    const item = items()[reg.selectedIndex()];
    return item === undefined
      ? undefined
      : commandPaletteRowId(listboxId, item.command.id);
  };
  const onKeyDown = (ev: KeyboardEvent): void => {
    if (untrack(reg.runningId) !== null) return;
    const count = untrack(items).length;
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const item = untrack(items)[untrack(reg.selectedIndex)];
      if (item !== undefined) void reg.invoke(item.command.id);
      return;
    }
    const next = nextPaletteSelection({
      key: ev,
      current: untrack(reg.selectedIndex),
      count,
    });
    if (next !== null) {
      ev.preventDefault();
      reg.setSelectedIndex(next);
    }
  };
  return { rows, items, activeId, onKeyDown };
}

function PaletteCard(props: {
  reg: CommandRegistryContextValue;
  model: PaletteModel;
  listboxId: string;
  footerLegend: JSX.Element | undefined;
}): JSX.Element {
  // Static per palette instance: the registry context and its derived model.
  const reg = untrack(() => props.reg);
  const model = untrack(() => props.model);
  const running = (): boolean => reg.runningId() !== null;
  return (
    <div
      class="box rounded-[20px] border border-border overflow-hidden bg-surface-overlay"
      data-component="CommandPaletteCard"
    >
      <Show when={running()} fallback={<div class="box h-[2px]" />}>
        <ProgressBar indeterminate height={2} color="tint" />
      </Show>
      <div class="box px-3 py-2">
        <CommandPaletteInput
          value={reg.query()}
          onChangeText={reg.setQuery}
          onKeyDown={model.onKeyDown}
          editable={!running()}
          listboxId={props.listboxId}
          activeDescendantId={model.activeId()}
        />
      </div>
      <Show
        when={model.rows().rows.length > 0}
        fallback={<CommandPaletteEmpty />}
      >
        <CommandPaletteList
          listboxId={props.listboxId}
          rows={model.rows().rows}
          selectedIndex={reg.selectedIndex()}
          query={reg.query()}
          runningId={reg.runningId()}
          getError={reg.getError}
          onSelectIndex={reg.setSelectedIndex}
          onActivate={(id) => {
            if (!running()) void reg.invoke(id);
          }}
        />
      </Show>
      <CommandPaletteHint legend={props.footerLegend} />
    </div>
  );
}

export function CommandPalette(props: CommandPaletteProps): JSX.Element {
  const { t } = useLingui();
  const reg = useCommandRegistry();
  const listboxId = `command-palette-listbox-${createUniqueId()}`;
  return (
    <ModalRoot
      visible={reg.isOpen()}
      onRequestClose={reg.close}
      stackId="command-palette"
      label={t`Command palette`}
      dataSet={{ component: 'CommandPalette', ...props.dataSet }}
    >
      <div class="box flex-1 w-[100%] h-[100%]">
        <div
          class="box absolute inset-0 bg-scrim"
          data-component="ModalScrim"
          aria-hidden="true"
          onClick={() => reg.close()}
        />
        <div
          class="box"
          classList={{
            [['absolute inset-0 items-center justify-start', undefined]
              .filter(Boolean)
              .join(' ')]: !![
              'absolute inset-0 items-center justify-start',
              undefined,
            ]
              .filter(Boolean)
              .join(' '),
          }}
          style={{
            'padding-top': `${TOP_INSET_STEP * 4}px`,
            'padding-left': `${MODAL_CONTENT_MARGIN_STEP * 4}px`,
            'padding-right': `${MODAL_CONTENT_MARGIN_STEP * 4}px`,
          }}
        >
          <ModalContent size="medium" padded={false}>
            <PaletteCard
              reg={reg}
              model={createPaletteModel(reg, listboxId)}
              listboxId={listboxId}
              footerLegend={props.footerLegend}
            />
          </ModalContent>
        </div>
      </div>
    </ModalRoot>
  );
}
