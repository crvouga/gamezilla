import { Box } from '../box';
import { Text } from '../text';
import { isMacPlatform } from './keyboard-shortcut';

function formatToken(t: string): string {
  const k = t.trim().toLowerCase();
  if (k === 'mod') {
    return isMacPlatform() ? '⌘' : 'Ctrl';
  }
  if (k === 'shift') return '⇧';
  if (k === 'alt' || k === 'option') return isMacPlatform() ? '⌥' : 'Alt';
  if (k === 'ctrl' || k === 'control') return 'Ctrl';
  if (k === 'meta' || k === 'command' || k === 'cmd') return '⌘';
  if (k === 'escape' || k === 'esc') return 'Esc';
  if (k.length === 1) return k.toUpperCase();
  return t;
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
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1, flexShrink: 0 }}>
      {parts.map((p, i) => (
        <Box
          key={`${p}-${i}`}
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: 'border',
            background: 'surface',
          }}
        >
          <Text variant="caption" sx={{ color: 'textSecondary' }} label={p} />
        </Box>
      ))}
    </Box>
  );
}
