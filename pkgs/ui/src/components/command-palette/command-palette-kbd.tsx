/** @jsxImportSource solid-js */
/**
 * `CommandPaletteKbd` -- renders a shortcut spec (`mod+shift+p`) as key-cap
 * chips, resolving `mod` / `alt` to the current platform's glyphs.
 */

import { createMemo, For, type JSX, Show } from 'solid-js';
import { Box } from '../box';
import { isMacPlatform } from '../keyboard-shortcuts';
import { Text } from '../text';

const STATIC_TOKEN_MAP: Readonly<Record<string, string>> = {
  shift: '⇧',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  meta: '⌘',
  command: '⌘',
  cmd: '⌘',
  escape: 'Esc',
  esc: 'Esc',
  enter: '↵',
  return: '↵',
};

function formatPlatformToken(k: string): string | undefined {
  if (k === 'mod') return isMacPlatform() ? '⌘' : 'Ctrl';
  if (k === 'alt' || k === 'option') return isMacPlatform() ? '⌥' : 'Alt';
  return undefined;
}

/** Human label for one shortcut token. Exported for tests. */
export function formatShortcutToken(token: string): string {
  const k = token.trim().toLowerCase();
  const platformToken = formatPlatformToken(k);
  if (platformToken !== undefined) return platformToken;
  const staticToken = STATIC_TOKEN_MAP[k];
  if (staticToken !== undefined) return staticToken;
  if (k.length === 1) return k.toUpperCase();
  return token.trim();
}

/** Split a spec like `mod+shift+p` into display tokens. */
export function shortcutTokens(shortcut: string): string[] {
  return shortcut
    .split('+')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map(formatShortcutToken);
}

export type CommandPaletteKbdProps = {
  shortcut: string;
};

export function CommandPaletteKbd(props: CommandPaletteKbdProps): JSX.Element {
  const parts = createMemo(() => shortcutTokens(props.shortcut));
  return (
    <Show when={parts().length > 0}>
      <Box
        as="span"
        aria-label={parts().join(' ')}
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1,
          flexShrink: 0,
        }}
        dataSet={{ component: 'CommandPaletteKbd' }}
      >
        <For each={parts()}>
          {(part) => (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 'xs',
                borderWidth: 1,
                borderColor: 'border',
                backgroundColor: 'surfaceMuted',
              }}
            >
              <Text
                variant="caption"
                sx={{ color: 'textSecondary' }}
                label={part}
              />
            </Box>
          )}
        </For>
      </Box>
    </Show>
  );
}
