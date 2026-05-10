import { useSpaceSessionUi } from '@gamezilla/client/spaces/layout/space-session-ui-context';
import { useCurrentSpaceRole } from '@gamezilla/client/spaces/use-current-space-role';
import { Button, IconButton, IconSymbol, useTheme } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

export type SpaceSessionChromeActionsProps = {
  compact: boolean;
};

export function SpaceSessionChromeActions({
  compact,
}: SpaceSessionChromeActionsProps) {
  const { t } = useLingui();
  const theme = useTheme();
  const { spaceId, onRequestEnd, onRequestLeave } = useSpaceSessionUi();
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';

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
    <Button title={t`End space`} onPress={onRequestEnd} />
  ) : (
    <Button title={t`Leave space`} intent="neutral" onPress={onRequestLeave} />
  );
}
