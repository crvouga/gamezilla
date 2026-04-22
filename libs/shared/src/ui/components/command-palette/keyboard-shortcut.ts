import { Platform } from 'react-native';

export type NormalizedShortcut = {
  keys: string[];
};

const MOD_ALIASES = new Set(['mod', 'command', 'cmd', 'ctrl', 'control']);

function normalizeKeyToken(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (k === 'escape') return 'esc';
  return k;
}

/**
 * Parse strings like `mod+shift+p` or `Mod + K` into ordered key tokens.
 */
export function parseShortcutString(spec: string): NormalizedShortcut {
  const parts = spec
    .split('+')
    .map((s) => normalizeKeyToken(s))
    .filter(Boolean);
  return { keys: parts };
}

export function isMacPlatform(): boolean {
  if (Platform.OS !== 'web') {
    return false;
  }
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform ?? '');
}

export type WebKeyboardEventLike = {
  key: string;
  code?: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  defaultPrevented?: boolean;
  preventDefault(): void;
};

function eventKeyToken(ev: WebKeyboardEventLike): string {
  const k = ev.key;
  if (k === ' ') return 'space';
  return k.length === 1 ? k.toLowerCase() : k.toLowerCase();
}

/**
 * Returns true when `ev` matches the normalized shortcut from `parseShortcutString`.
 * `mod` is Meta on macOS web, Ctrl elsewhere (VSCode / Linear style).
 */
export function matchesWebShortcut(
  spec: string,
  ev: WebKeyboardEventLike,
): boolean {
  if (ev.repeat) {
    return false;
  }
  const { keys } = parseShortcutString(spec);
  if (keys.length === 0) {
    return false;
  }

  const mac = isMacPlatform();
  let needMeta = false;
  let needCtrl = false;
  let needAlt = false;
  let needShift = false;
  const mainKeys: string[] = [];

  for (const token of keys) {
    if (token === 'shift') {
      needShift = true;
      continue;
    }
    if (token === 'alt' || token === 'option') {
      needAlt = true;
      continue;
    }
    if (MOD_ALIASES.has(token) || token === 'meta' || token === 'super') {
      if (token === 'meta' || token === 'super' || token === 'command' || token === 'cmd') {
        needMeta = true;
      } else if (token === 'ctrl' || token === 'control') {
        needCtrl = true;
      } else {
        // `mod`
        if (mac) {
          needMeta = true;
        } else {
          needCtrl = true;
        }
      }
      continue;
    }
    mainKeys.push(token);
  }

  if (mainKeys.length !== 1) {
    return false;
  }
  const want = mainKeys[0]!;

  if (needShift !== ev.shiftKey) return false;
  if (needAlt !== ev.altKey) return false;

  if (needMeta && !ev.metaKey) return false;
  if (needCtrl && !ev.ctrlKey) return false;
  // If neither meta nor ctrl required from mod parsing, still allow plain letter
  if (!needMeta && !needCtrl) {
    // no modifier required in spec — rare
  } else {
    if (needMeta && ev.ctrlKey && !mac) {
      return false;
    }
    if (needCtrl && ev.metaKey && !mac) {
      return false;
    }
  }

  const got = eventKeyToken(ev);
  if (want === 'esc') {
    return got === 'escape';
  }
  return got === want;
}
