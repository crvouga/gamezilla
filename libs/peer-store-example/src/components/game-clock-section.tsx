import { Button, Card, Stack, Text } from '@gamezilla/lib/ui';
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
  const realtimeTitle = clock.realtimeEnabled ? 'Stop realtime' : 'Start realtime';
  const realtimePress = clock.realtimeEnabled
    ? clock.stopRealtime
    : clock.startRealtime;

  return (
    <Card elevation={1} sx={{ p: 4, gap: 2 }}>
      <Text variant="label" label="Game Clock" />
      <Stack direction="horizontal" spacing={3} wrap align="center">
        <Text variant="caption" label={`Status: ${clock.snapshot.clockStatus}`} />
        <Text variant="caption" label={`Turn: ${clock.snapshot.clockActivePlayer ?? '-'}`} />
        <Text variant="caption" label={`X ${formatMs(clock.snapshot.remainingMsX)}`} />
        <Text variant="caption" label={`O ${formatMs(clock.snapshot.remainingMsO)}`} />
        <Text variant="caption" label={`Logical t=${clock.logicalTimeMs}ms`} />
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
          title="+1s"
          variant="outlined"
          size="sm"
          onPress={clock.addOneSecond}
          disabled={!clock.canEnableRealtime}
        />
        <Button
          title="+5s"
          variant="outlined"
          size="sm"
          onPress={clock.addFiveSeconds}
          disabled={!clock.canEnableRealtime}
        />
      </Stack>
    </Card>
  );
}
