/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';

/**
 * `CommandPaletteRow` -- one command inside the palette listbox: icon,
 * fuzzy-highlighted title, subtitle, shortcut chips (or a spinner while
 * running) and an inline error line. Exposed as `role="option"` with
 * `aria-selected` mirroring keyboard selection.
 */

import type { MatchRange } from '@pkgs/ui-root-shared-ts/fuzzy-match';
import { fuzzyMatch } from '@pkgs/ui-root-shared-ts/fuzzy-match';
import { createMemo, type JSX, Show } from 'solid-js';
import { CommandPaletteKbd } from '../command-palette-kbd/index';
import type { IconComponent } from '../create-icon/index';
import { HighlightedText } from '../highlighted-text/index';
import { Spinner } from '../spinner/index';
import type { RegisteredCommand } from '../types';
import { isCommandEnabled, normalizeShortcut } from '../types';

export const COMMAND_PALETTE_ROW_MIN_HEIGHT = 44;

export type CommandPaletteRowProps = {
  id: string;
  command: RegisteredCommand;
  query: string;
  selected: boolean;
  running: boolean;
  /** Inline error message for the row; `undefined` when none. */
  error: string | undefined;
  onSelect: () => void;
  /** Hover moves keyboard selection to this row. */
  onHover?: (() => void) | undefined;
};

function RowIcon(props: { icon: IconComponent | undefined }): JSX.Element {
  return (
    <Show when={props.icon} fallback={<div class="box w-5" />}>
      {(icon) => {
        const Icon = icon();
        return <Icon size={18} color="icon" />;
      }}
    </Show>
  );
}

function RowTrailing(props: {
  running: boolean;
  shortcut: string | undefined;
}): JSX.Element {
  return (
    <Show when={!props.running} fallback={<Spinner size="sm" />}>
      <Show when={props.shortcut}>
        {(shortcut) => <CommandPaletteKbd shortcut={shortcut()} />}
      </Show>
    </Show>
  );
}

export function CommandPaletteRow(props: CommandPaletteRowProps): JSX.Element {
  const enabled = (): boolean => isCommandEnabled(props.command);
  const disabled = (): boolean => !enabled() || props.running;
  const ranges = createMemo(
    (): MatchRange[] =>
      fuzzyMatch(props.query.trim(), props.command.title)?.ranges ?? []
  );
  const shortcut = (): string | undefined =>
    normalizeShortcut(props.command.shortcut)?.keys;
  return (
    <button
      class="clickable clickableTint py-2 px-3 gap-1 text-left border-l-3 border-l-transparent"
      classList={{
        'bg-tint-subtle border-l-tint': props.selected,
      }}
      data-component="CommandPaletteRow"
      type="button"
      style={{
        'min-height': cssPx(COMMAND_PALETTE_ROW_MIN_HEIGHT),
        opacity: enabled() ? 1 : 0.45,
      }}
      id={props.id}
      role="option"
      aria-selected={props.selected}
      aria-disabled={disabled() ? true : undefined}
      tabIndex={-1}
      disabled={disabled()}
      onClick={() => props.onSelect()}
      onMouseEnter={() => props.onHover?.()}
    >
      <div class="box flex-row items-center gap-2 min-w-0">
        <RowIcon icon={props.command.icon} />
        <div class="box flex-1 min-w-0">
          <HighlightedText
            text={props.command.title}
            ranges={ranges()}
            numberOfLines={1}
          />
          <Show when={props.command.subtitle}>
            {(subtitle) => (
              <p class="text textCaption line-clamp-1 text-text-secondary">
                {subtitle()}
              </p>
            )}
          </Show>
        </div>
        <RowTrailing running={props.running} shortcut={shortcut()} />
      </div>
      <Show when={props.error}>
        {(error) => (
          <p class="text textCaption text-destructive pl-7" role="alert">
            {error()}
          </p>
        )}
      </Show>
    </button>
  );
}
