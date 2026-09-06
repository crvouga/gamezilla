import { Platform } from 'react-native';

export type NormalizedShortcut = {
  keys: string[];
};

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

type ShortcutDescriptor = {
  needMeta: boolean;
  needCtrl: boolean;
  needAlt: boolean;
  needShift: boolean;
  mainKey: string;
};

const META_ALIASES = new Set(['meta', 'super', 'command', 'cmd']);
const CTRL_ALIASES = new Set(['ctrl', 'control']);

function classifyToken(
  token: string,
  desc: ShortcutDescriptor,
  mac: boolean,
  mainKeys: string[]
): void {
  if (token === 'shift') {
    desc.needShift = true;
    return;
  }
  if (token === 'alt' || token === 'option') {
    desc.needAlt = true;
    return;
  }
  if (META_ALIASES.has(token)) {
    desc.needMeta = true;
    return;
  }
  if (CTRL_ALIASES.has(token)) {
    desc.needCtrl = true;
    return;
  }
  if (token === 'mod') {
    if (mac) desc.needMeta = true;
    else desc.needCtrl = true;
    return;
  }
  mainKeys.push(token);
}

function describeShortcut(
  keys: string[],
  mac: boolean
): ShortcutDescriptor | null {
  const desc: ShortcutDescriptor = {
    needMeta: false,
    needCtrl: false,
    needAlt: false,
    needShift: false,
    mainKey: '',
  };
  const mainKeys: string[] = [];
  for (const token of keys) classifyToken(token, desc, mac, mainKeys);
  if (mainKeys.length !== 1) return null;
  desc.mainKey = mainKeys[0]!;
  return desc;
}

function matchesRequiredModifiers(
  desc: ShortcutDescriptor,
  ev: WebKeyboardEventLike
): boolean {
  if (desc.needShift !== ev.shiftKey) return false;
  if (desc.needAlt !== ev.altKey) return false;
  if (desc.needMeta && !ev.metaKey) return false;
  if (desc.needCtrl && !ev.ctrlKey) return false;
  return true;
}

function rejectsCrossPlatformMix(
  desc: ShortcutDescriptor,
  ev: WebKeyboardEventLike
): boolean {
  if (desc.needMeta && ev.ctrlKey) return true;
  if (desc.needCtrl && ev.metaKey) return true;
  return false;
}

function matchesModifiers(
  desc: ShortcutDescriptor,
  ev: WebKeyboardEventLike,
  mac: boolean
): boolean {
  if (!matchesRequiredModifiers(desc, ev)) return false;
  if (mac) return true;
  return !rejectsCrossPlatformMix(desc, ev);
}

/**
 * Returns true when `ev` matches the normalized shortcut from `parseShortcutString`.
 * `mod` is Meta on macOS web, Ctrl elsewhere (VSCode / Linear style).
 */
export function matchesWebShortcut(
  spec: string,
  ev: WebKeyboardEventLike
): boolean {
  if (ev.repeat) return false;
  const { keys } = parseShortcutString(spec);
  if (keys.length === 0) return false;

  const mac = isMacPlatform();
  const desc = describeShortcut(keys, mac);
  if (desc === null) return false;
  if (!matchesModifiers(desc, ev, mac)) return false;

  const got = eventKeyToken(ev);
  if (desc.mainKey === 'esc') return got === 'escape';
  return got === desc.mainKey;
}

export function toWebKeyboardEventLike(
  ev: KeyboardEvent
): WebKeyboardEventLike {
  return {
    key: ev.key,
    code: ev.code,
    metaKey: ev.metaKey,
    ctrlKey: ev.ctrlKey,
    altKey: ev.altKey,
    shiftKey: ev.shiftKey,
    repeat: ev.repeat,
    preventDefault: () => ev.preventDefault(),
  };
}
