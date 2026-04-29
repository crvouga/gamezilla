import {
  Badge,
  Button,
  Stack,
  StatusDot,
  Text,
} from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

export function PeerPanelHeader({
  role,
  isOnline,
  isBadActor,
  isCheater,
  onDisconnect,
  onReconnect,
}: {
  role: string;
  isOnline: boolean;
  isBadActor: boolean;
  isCheater: boolean;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const { t } = useLingui();
  const hasBadges = isCheater || isBadActor;
  const buttonTitle = isOnline ? t`Disconnect` : t`Reconnect`;
  const buttonPress = isOnline ? onDisconnect : onReconnect;

  return (
    <Stack spacing={1}>
      <Stack direction="horizontal" align="center" justify="space-between">
        <Stack direction="horizontal" spacing={2} align="center">
          <Text variant="subtitle" numberOfLines={1} label={role} />
          <StatusDot status={isOnline ? 'online' : 'offline'} />
        </Stack>
        <Button
          title={buttonTitle}
          variant="outlined"
          size="sm"
          color={isOnline ? 'destructive' : 'success'}
          onPress={buttonPress}
        />
      </Stack>
      {hasBadges && (
        <Stack direction="horizontal" spacing={2}>
          {isCheater && <Badge label="CHEATER" color="warning" size="sm" />}
          {isBadActor && (
            <Badge label={t`BAD ACTOR`} color="destructive" size="sm" />
          )}
        </Stack>
      )}
    </Stack>
  );
}
