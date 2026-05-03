import type { IconSymbolName } from '../symbol-icon';

export type CommandId = string;

export type CommandShortcut = {
  keys: string;
  platforms?: Array<'web' | 'ios' | 'android'>;
};

export type Command = {
  id: CommandId;
  title: string;
  subtitle?: string;
  category?: string;
  icon?: IconSymbolName;
  keywords?: string[];
  shortcut?: string | CommandShortcut;
  enabled?: boolean | (() => boolean);
  visible?: boolean;
  run: () => void | Promise<void>;
};

export type RegisteredCommand = Command & {
  /** Internal stamp for debugging; registry uses `registrationId` for ownership. */
  _version: number;
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
  ].filter(Boolean);
  return parts.join(' ').toLowerCase();
}

export function isCommandEnabled(cmd: Command): boolean {
  if (typeof cmd.enabled === 'function') {
    return cmd.enabled();
  }
  if (cmd.enabled === false) {
    return false;
  }
  return true;
}

export function isCommandVisible(cmd: Command): boolean {
  if (cmd.visible === false) {
    return false;
  }
  return true;
}
