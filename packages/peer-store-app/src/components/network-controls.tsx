import { Button, Card, Stack, Text } from '@gamezilla/shared/ui';

export function NetworkControls({
  onPause,
  onResume,
  onDrop,
  onAdvance,
  onDisconnect,
  onReconnect,
  isPaused,
  disconnectedPeers,
}: {
  onPause: () => void;
  onResume: () => void;
  onDrop: () => void;
  onAdvance: () => void;
  onDisconnect: (peerId: string) => void;
  onReconnect: (peerId: string) => void;
  isPaused: boolean;
  disconnectedPeers: Set<string>;
}) {
  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="label" style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
        Network Controls
      </Text>
      <Stack direction="horizontal" spacing={2} wrap>
        <Button
          title="Pause"
          variant="outlined"
          size="sm"
          onPress={onPause}
          disabled={isPaused}
        />
        <Button
          title="Resume"
          variant="outlined"
          size="sm"
          onPress={onResume}
          disabled={!isPaused}
        />
        <Button title="Drop next" variant="outlined" size="sm" onPress={onDrop} />
        <Button title="Advance 5s" variant="outlined" size="sm" onPress={onAdvance} />
      </Stack>
      <Stack direction="horizontal" spacing={2} wrap>
        {['player-x', 'player-o', 'worker'].map((peerId) => {
          const isDisconnected = disconnectedPeers.has(peerId);
          return (
            <Button
              key={peerId}
              title={isDisconnected ? `Reconnect ${peerId}` : `Disconnect ${peerId}`}
              variant="outlined"
              size="sm"
              onPress={() =>
                isDisconnected
                  ? onReconnect(peerId)
                  : onDisconnect(peerId)
              }
            />
          );
        })}
      </Stack>
    </Card>
  );
}
