import {
  Button,
  IconButton,
  IconSymbol,
  useTheme,
} from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

export type SpaceSessionChromeActionsProps = {
  isHost: boolean;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  compact: boolean;
};

export function SpaceSessionChromeActions({
  isHost,
  onRequestEnd,
  onRequestLeave,
  compact,
}: SpaceSessionChromeActionsProps) {
  const { t } = useLingui();
  const theme = useTheme();

  if (compact) {
    return isHost ? (
      <IconButton
        size={40}
        background="destructive"
        onPress={onRequestEnd}
        accessibilityLabel={t`End space`}
      >
        <IconSymbol name="xmark" size={18} color={theme.colors.surface} />
      </IconButton>
    ) : (
      <IconButton
        size={40}
        background="surface"
        onPress={onRequestLeave}
        accessibilityLabel={t`Leave space`}
      >
        <IconSymbol
          name="arrow.right.from.bracket"
          size={18}
          color={theme.colors.text}
        />
      </IconButton>
    );
  }

  return isHost ? (
    <Button title={t`End space`} variant="solid" onPress={onRequestEnd} />
  ) : (
    <Button title={t`Leave space`} variant="outlined" onPress={onRequestLeave} />
  );
}
