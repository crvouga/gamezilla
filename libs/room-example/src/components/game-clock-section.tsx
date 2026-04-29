import { Button, Card, Stack, Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { GameClockControls } from '../pages/use-game-clock';

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function GameClockSection({
  clock,
}: {
  clock: GameClockControls;
}) {
  const { t } = useLingui();
  const realtimeTitle = clock.realtimeEnabled
    ? t`Stop realtime`
    : t`Start realtime`;
  const realtimePress = clock.realtimeEnabled
    ? clock.stopRealtime
    : clock.startRealtime;
  const status = clock.snapshot.clockStatus;
  const turn = clock.snapshot.clockActivePlayer ?? '-';
  const remainingX = formatMs(clock.snapshot.remainingMsX);
  const remainingO = formatMs(clock.snapshot.remainingMsO);
  const logicalTime = clock.logicalTimeMs;

  return (
    <Card elevation={1} sx={{ p: 4, gap: 2 }}>
      <Text variant="label" label={t`Game Clock`} />
      <Stack direction="horizontal" spacing={3} wrap align="center">
        <Text variant="caption" label={t`Status: ${status}`} />
        <Text variant="caption" label={t`Turn: ${turn}`} />
        <Text variant="caption" label={t`X ${remainingX}`} />
        <Text variant="caption" label={t`O ${remainingO}`} />
        <Text variant="caption" label={t`Logical t=${logicalTime}ms`} />
      </Stack>
      <Stack direction="horizontal" spacing={2} wrap>
        <Button
          title={realtimeTitle}
          variant="outlined"
          size="sm"
          onPress={realtimePress}
          disabled={!clock.realtimeEnabled && !clock.canEnableRealtime}
        />
        <Button
          title={t`+1s`}
          variant="outlined"
          size="sm"
          onPress={clock.addOneSecond}
          disabled={!clock.canEnableRealtime}
        />
        <Button
          title={t`+5s`}
          variant="outlined"
          size="sm"
          onPress={clock.addFiveSeconds}
          disabled={!clock.canEnableRealtime}
        />
      </Stack>
    </Card>
  );
}
