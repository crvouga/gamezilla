import { useTheme } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { Spinner } from '../spinner';
import { IconSymbol, type IconSymbolName } from '../symbol-icon';
import { Text } from '../text';
import { CommandPaletteKbd } from './command-palette-kbd';
import { fuzzyMatch } from './fuzzy-match';
import { HighlightedText } from './highlighted-text';
import type { RegisteredCommand } from './types';
import { isCommandEnabled, normalizeShortcut } from './types';

export type CommandPaletteItemProps = {
  command: RegisteredCommand;
  query: string;
  selected: boolean;
  running: boolean;
  /** Inline error message for the row; pass `undefined` when none. */
  error: string | undefined;
  onSelect: () => void;
};

export function CommandPaletteItem({
  command,
  query,
  selected,
  running,
  error,
  onSelect,
}: CommandPaletteItemProps) {
  const enabled = isCommandEnabled(command);
  const titleMatch = fuzzyMatch(query.trim(), command.title);
  const ranges = titleMatch?.ranges ?? [];
  const shortcutStr = normalizeShortcut(command.shortcut)?.keys;

  return (
    <Pressable
      onPress={onSelect}
      disabled={!enabled || running}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !enabled || running }}
      sx={{
        py: 3,
        px: 3,
        flexDirection: 'column',
        gap: 1,
        background: selected ? 'tintMuted' : 'transparent',
        borderLeftWidth: 3,
        borderLeftColor: selected ? 'tint' : 'transparent',
        opacity: enabled ? 1 : 0.45,
      }}
    >
      <Box
        sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 0 }}
      >
        <ItemIcon icon={command.icon} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <HighlightedText text={command.title} ranges={ranges} />
          <ItemSubtitle subtitle={command.subtitle} />
        </Box>
        <ItemTrailing running={running} shortcut={shortcutStr} />
      </Box>
      <ItemError error={error} />
    </Pressable>
  );
}

function ItemIcon({ icon }: { icon: IconSymbolName | undefined }) {
  const theme = useTheme();
  if (icon === undefined) return <Box sx={{ width: 18 }} />;
  return <IconSymbol name={icon} size={18} color={theme.colors.icon} />;
}

function ItemSubtitle({ subtitle }: { subtitle: string | undefined }) {
  if (subtitle === undefined) return null;
  return (
    <Text
      variant="caption"
      numberOfLines={1}
      ellipsizeMode="tail"
      sx={{ color: 'textSecondary' }}
      label={subtitle}
    />
  );
}

function ItemTrailing({
  running,
  shortcut,
}: {
  running: boolean;
  shortcut: string | undefined;
}) {
  if (running) return <Spinner />;
  if (shortcut === undefined) return null;
  return <CommandPaletteKbd shortcut={shortcut} />;
}

function ItemError({ error }: { error: string | undefined }) {
  if (error === undefined) return null;
  return (
    <Text
      variant="caption"
      sx={{ color: 'destructive', pl: 7 }}
      label={error}
    />
  );
}
