/** @jsxImportSource solid-js */

import { isMacPlatform } from '@pkgs/ui-root-shared-ts/match';
import { createMemo, For, type JSX, Show } from 'solid-js';

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

/**
 * `CommandPaletteKbd` -- renders a shortcut spec (`mod+shift+p`) as key-cap
 * chips, resolving `mod` / `alt` to the current platform's glyphs.
 */
export function CommandPaletteKbd(props: CommandPaletteKbdProps): JSX.Element {
  const parts = createMemo(() => shortcutTokens(props.shortcut));
  return (
    <Show when={parts().length > 0}>
      <span
        class="box flex-row items-center gap-1 shrink-0"
        data-component="CommandPaletteKbd"
        aria-label={parts().join(' ')}
      >
        <For each={parts()}>
          {(part) => (
            <div class="box px-2 py-1 rounded-sm border border-border bg-surface-muted">
              <p class="text textCaption text-text-secondary">{part}</p>
            </div>
          )}
        </For>
      </span>
    </Show>
  );
}
