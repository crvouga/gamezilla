import { fuzzyMatch } from './fuzzy-match';
import { CommandPaletteKbd } from './command-palette-kbd';
import { HighlightedText } from './highlighted-text';
import { Box } from '../box';
import { IconSymbol } from '../symbol-icon';
import { Pressable } from '../pressable';
import { Spinner } from '../spinner';
import { Text } from '../text';
import { useTheme } from '../../theme';
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
  const theme = useTheme();
  const enabled = isCommandEnabled(command);
  const titleMatch = fuzzyMatch(query.trim(), command.title);
  const ranges = titleMatch?.ranges ?? [];

  const sc = normalizeShortcut(command.shortcut);
  const shortcutStr = sc?.keys;

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
        background: selected ? 'paper' : 'transparent',
        borderLeftWidth: 3,
        borderLeftColor: selected ? 'tint' : 'transparent',
        opacity: enabled ? 1 : 0.45,
      }}
    >
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 0 }}>
        {command.icon !== undefined ? (
          <IconSymbol
            name={command.icon}
            size={18}
            color={theme.colors.icon}
          />
        ) : (
          <Box sx={{ width: 18 }} />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <HighlightedText text={command.title} ranges={ranges} />
          {command.subtitle !== undefined ? (
            <Text
              variant="caption"
              numberOfLines={1}
              ellipsizeMode="tail"
              sx={{ color: 'textSecondary' }}
              label={command.subtitle}
            />
          ) : null}
        </Box>
        {running ? (
          <Spinner size="small" />
        ) : shortcutStr !== undefined ? (
          <CommandPaletteKbd shortcut={shortcutStr} />
        ) : null}
      </Box>
      {error !== undefined ? (
        <Text variant="caption" sx={{ color: 'destructive', pl: 7 }} label={error} />
      ) : null}
    </Pressable>
  );
}
