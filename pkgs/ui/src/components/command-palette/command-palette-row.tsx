/** @jsxImportSource solid-js */
/**
 * `CommandPaletteRow` -- one command inside the palette listbox: icon,
 * fuzzy-highlighted title, subtitle, shortcut chips (or a spinner while
 * running) and an inline error line. Exposed as `role="option"` with
 * `aria-selected` mirroring keyboard selection.
 */

import { createMemo, type JSX, Show } from 'solid-js';
import { Box } from '../box';
import { Clickable } from '../clickable';
import type { IconComponent } from '../icons';
import { Spinner } from '../spinner';
import { Text } from '../text';
import { CommandPaletteKbd } from './command-palette-kbd';
import { fuzzyMatch, type MatchRange } from './fuzzy-match';
import { HighlightedText } from './highlighted-text';
import {
  isCommandEnabled,
  normalizeShortcut,
  type RegisteredCommand,
} from './types';

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
    <Show when={props.icon} fallback={<Box sx={{ width: 18 }} />}>
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
    <Show when={!props.running} fallback={<Spinner size="small" />}>
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
    <Clickable
      id={props.id}
      role="option"
      aria-selected={props.selected}
      aria-disabled={disabled() ? true : undefined}
      tabIndex={-1}
      disabled={disabled()}
      onClick={() => props.onSelect()}
      onMouseEnter={() => props.onHover?.()}
      dataSet={{ component: 'CommandPaletteRow' }}
      sx={{
        minHeight: COMMAND_PALETTE_ROW_MIN_HEIGHT,
        py: 2,
        px: 3,
        gap: 1,
        textAlign: 'left',
        backgroundColor: props.selected ? 'tintSubtle' : 'transparent',
        borderLeftWidth: 3,
        borderLeftColor: props.selected ? 'tint' : 'transparent',
        opacity: enabled() ? 1 : 0.45,
      }}
    >
      <Box
        sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 0 }}
      >
        <RowIcon icon={props.command.icon} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <HighlightedText
            text={props.command.title}
            ranges={ranges()}
            numberOfLines={1}
          />
          <Show when={props.command.subtitle}>
            {(subtitle) => (
              <Text
                variant="caption"
                numberOfLines={1}
                sx={{ color: 'textSecondary' }}
                label={subtitle()}
              />
            )}
          </Show>
        </Box>
        <RowTrailing running={props.running} shortcut={shortcut()} />
      </Box>
      <Show when={props.error}>
        {(error) => (
          <Text
            role="alert"
            variant="caption"
            sx={{ color: 'destructive', pl: 7 }}
            label={error()}
          />
        )}
      </Show>
    </Clickable>
  );
}
