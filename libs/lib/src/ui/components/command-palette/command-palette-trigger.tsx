import type { LocalizedString } from '@gamezilla/lib/i18n';
import { useLingui } from '@lingui/react/macro';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { Pressable } from '../pressable';
import { IconSymbol } from '../symbol-icon';
import { useCommandPalette } from './use-command-palette';

export type CommandPaletteTriggerProps = {
  /** Icon name from the design-system registry. Defaults to checklist. */
  icon?: 'checklist' | 'ellipsis' | 'gearshape.fill';
  /** Pixel size of the tappable area. Defaults to 40. */
  size?: number;
  accessibilityLabel?: LocalizedString;
};

/**
 * Opens the command palette — use on native or alongside keyboard shortcuts on web.
 */
export function CommandPaletteTrigger({
  icon = 'checklist',
  size = 40,
  accessibilityLabel,
}: CommandPaletteTriggerProps) {
  const { t } = useLingui();
  const theme = useTheme();
  const { toggle } = useCommandPalette();
  const a11y = accessibilityLabel ?? t`Open command palette`;

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      sx={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ alignItems: 'center', justifyContent: 'center' }}>
        <IconSymbol name={icon} size={22} color={theme.colors.icon} />
      </Box>
    </Pressable>
  );
}
