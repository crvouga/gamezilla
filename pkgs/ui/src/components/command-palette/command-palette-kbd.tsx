import { borderRadius } from '../../theme/scale';
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
};

function formatToken(t: string): string {
  const k = t.trim().toLowerCase();
  const platformToken = formatPlatformToken(k);
  if (platformToken !== undefined) return platformToken;
  const staticToken = STATIC_TOKEN_MAP[k];
  if (staticToken !== undefined) return staticToken;
  if (k.length === 1) return k.toUpperCase();
  return t;
}

function formatPlatformToken(k: string): string | undefined {
  if (k === 'mod') return isMacPlatform() ? '⌘' : 'Ctrl';
  if (k === 'alt' || k === 'option') return isMacPlatform() ? '⌥' : 'Alt';
  return undefined;
}

export type CommandPaletteKbdProps = {
  shortcut: string;
};

/**
 * Renders a shortcut string as key-cap chips (e.g. `mod+shift+p`).
 */
export function CommandPaletteKbd({ shortcut }: CommandPaletteKbdProps) {
  const parts = shortcut
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(formatToken);

  if (parts.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, flexShrink: 0 }}
    >
      {parts.map((p, i) => (
        <Box
          key={`${p}-${i}`}
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: borderRadius.xs,
            borderWidth: 1,
            borderColor: 'border',
            background: 'surfaceMuted',
          }}
        >
          <Text variant="caption" sx={{ color: 'textSecondary' }} label={p} />
        </Box>
      ))}
    </Box>
  );
}
