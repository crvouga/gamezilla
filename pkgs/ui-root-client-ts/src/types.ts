import type { IconComponent } from './create-icon/index';

export type CommandId = string;

export type CommandShortcut = {
  /** Shortcut spec, e.g. `mod+k` / `mod+shift+p` (see `parseShortcutString`). */
  keys: string;
  /** Platforms the shortcut binds on. Defaults to `['web']`. */
  platforms?: ('web' | 'ios' | 'android')[] | undefined;
};

export type Command = {
  id: CommandId;
  title: string;
  subtitle?: string | undefined;
  /** Section header the command is grouped under. Defaults to `Commands`. */
  category?: string | undefined;
  icon?: IconComponent | undefined;
  keywords?: readonly string[] | undefined;
  shortcut?: string | CommandShortcut | undefined;
  enabled?: boolean | (() => boolean) | undefined;
  visible?: boolean | undefined;
  run: () => void | Promise<void>;
};

export type RegisteredCommand = Command & {
  /** Internal stamp for debugging; the registry uses `registrationId` for ownership. */
  _version: number;
};

/** A section of the palette: header title plus the commands beneath it. */
export type CommandGroup = {
  title: string;
  commands: readonly RegisteredCommand[];
};

export function normalizeShortcut(
  shortcut: string | CommandShortcut | undefined
): CommandShortcut | undefined {
  if (shortcut === undefined) return undefined;
  if (typeof shortcut === 'string') {
    return { keys: shortcut };
  }
  return shortcut;
}

export function commandSearchText(cmd: Command): string {
  const parts = [
    cmd.title,
    cmd.subtitle,
    cmd.category,
    ...(cmd.keywords ?? []),
  ].filter((part): part is string => typeof part === 'string' && part !== '');
  return parts.join(' ').toLowerCase();
}

export function isCommandEnabled(cmd: Command): boolean {
  if (typeof cmd.enabled === 'function') {
    return cmd.enabled();
  }
  return cmd.enabled !== false;
}

export function isCommandVisible(cmd: Command): boolean {
  return cmd.visible !== false;
}
