import { Button, Stack, Text } from '@gamezilla/lib/ui';
import type { CheatHandlers } from './use-cheat-handlers';
import type { NetworkControls } from './use-network-controls';

function NetworkButtons({ network }: { network: NetworkControls }) {
  const pauseTitle = network.isPaused.current ? 'Resume' : 'Pause';
  const pausePress = network.isPaused.current ? network.resume : network.pause;
  return (
    <Stack direction="horizontal" spacing={2} wrap>
      <Button
        title={pauseTitle}
        variant="outlined"
        size="sm"
        onPress={pausePress}
      />
      <Button
        title="Drop next"
        variant="outlined"
        size="sm"
        onPress={network.drop}
      />
      <Button
        title="Advance 5s"
        variant="outlined"
        size="sm"
        onPress={network.advance}
      />
      <Button
        title="Reset"
        variant="outlined"
        size="sm"
        onPress={network.reset}
      />
      <Button
        title="Partition"
        variant="outlined"
        size="sm"
        onPress={network.scenarioPartition}
      />
      <Button
        title="Timeout"
        variant="outlined"
        size="sm"
        onPress={network.scenarioTimeout}
      />
    </Stack>
  );
}

function CheatButtons({ cheats }: { cheats: CheatHandlers }) {
  return (
    <Stack direction="horizontal" spacing={2} wrap>
      <Button
        title="Fabricate Commit"
        variant="outlined"
        size="sm"
        color="destructive"
        onPress={cheats.fabricate}
      />
      <Button
        title="Replay Events"
        variant="outlined"
        size="sm"
        color="destructive"
        onPress={cheats.replay}
      />
      <Button
        title="Tamper Events"
        variant="outlined"
        size="sm"
        color="destructive"
        onPress={cheats.tamper}
      />
      <Button
        title="Clear Tamper"
        variant="outlined"
        size="sm"
        onPress={cheats.clearTamper}
      />
    </Stack>
  );
}

export function NetworkControlsSection({
  network,
  cheats,
}: {
  network: NetworkControls;
  cheats: CheatHandlers;
}) {
  return (
    <Stack spacing={2}>
      <Text variant="label" label="Network Controls" />
      <NetworkButtons network={network} />
      <Text variant="label" label="Wire Attacks (MITM)" />
      <CheatButtons cheats={cheats} />
    </Stack>
  );
}
