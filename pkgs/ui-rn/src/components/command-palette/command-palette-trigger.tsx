import { useLingui } from '@lingui/react/macro';
import type { LocalizedString } from '@pkgs/i18n';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { Box } from '../box';
import { type IconComponent, ListChecksIcon } from '../icons';
import { Pressable } from '../pressable';
import { useCommandPalette } from './use-command-palette';

export type CommandPaletteTriggerProps = {
  /** Icon component from the design-system registry. Defaults to ListChecksIcon. */
  icon?: IconComponent;
  /** Pixel size of the tappable area. Defaults to 40. */
  size?: number;
  accessibilityLabel?: LocalizedString;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

/**
 * Opens the command palette — use on native or alongside keyboard shortcuts on web.
 */
export function CommandPaletteTrigger({
  icon = ListChecksIcon,
  size = 40,
  accessibilityLabel,
  dataSet,
}: CommandPaletteTriggerProps) {
  const { t } = useLingui();
  const theme = useTheme();
  const { toggle } = useCommandPalette();
  const a11y = accessibilityLabel ?? t`Open command palette`;
  const Icon = icon;

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      {...componentDataSet('CommandPaletteTrigger', dataSet)}
      sx={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color={theme.colors.icon} />
      </Box>
    </Pressable>
  );
}
