import { Button, Stack, Text } from '@gamezilla/lib/ui';
import type { CheatHandlers } from './use-cheat-handlers';
import type { NetworkControls } from './use-network-controls';

function NetworkButtons({ network }: { network: NetworkControls }) {
  const isPaused = network.isPaused.current;
  return (
    <Stack direction="horizontal" spacing={2} wrap>
      {!isPaused && (
        <Button title="Pause" variant="outlined" size="sm" onPress={network.pause} />
      )}
      {isPaused && (
        <Button title="Resume" variant="outlined" size="sm" onPress={network.resume} />
      )}
      <Button
        title="Drop next"
        variant="outlined"
        size="sm"
        onPress={network.drop}
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
    <Stack spacing={2}>
      <ReplayAndFabricationButtons cheats={cheats} />
      <IdentityBypassButtons cheats={cheats} />
      <ClockTamperingButtons cheats={cheats} />
      <MitmButtons cheats={cheats} />
    </Stack>
  );
}

function ReplayAndFabricationButtons({ cheats }: { cheats: CheatHandlers }) {
  return (
    <Stack spacing={1}>
      <Text variant="caption" label="Replay / Fabrication" />
      <Stack direction="horizontal" spacing={2} wrap>
        <Button title="Fabricate Commit" variant="outlined" size="sm" color="destructive" onPress={cheats.fabricate} />
        <Button title="Replay Events" variant="outlined" size="sm" color="destructive" onPress={cheats.replay} />
      </Stack>
    </Stack>
  );
}

function IdentityBypassButtons({ cheats }: { cheats: CheatHandlers }) {
  return (
    <Stack spacing={1}>
      <Text variant="caption" label="Identity / Authority Bypass" />
      <Stack direction="horizontal" spacing={2} wrap>
        <Button title="X: non-authority trust_update" variant="outlined" size="sm" color="destructive" onPress={cheats.unauthorizedTrustX} />
        <Button title="O: non-authority trust_update" variant="outlined" size="sm" color="destructive" onPress={cheats.unauthorizedTrustO} />
      </Stack>
    </Stack>
  );
}

function ClockTamperingButtons({ cheats }: { cheats: CheatHandlers }) {
  return (
    <Stack spacing={1}>
      <Text variant="caption" label="Clock Tampering" />
      <Stack direction="horizontal" spacing={2} wrap>
        <Button title="X: force TickClock" variant="outlined" size="sm" color="destructive" onPress={cheats.forcedClockX} />
        <Button title="O: force TickClock" variant="outlined" size="sm" color="destructive" onPress={cheats.forcedClockO} />
      </Stack>
    </Stack>
  );
}

function MitmButtons({ cheats }: { cheats: CheatHandlers }) {
  return (
    <Stack spacing={1}>
      <Text variant="caption" label="MITM Integrity" />
      <Stack direction="horizontal" spacing={2} wrap>
        {!cheats.tamperActive && (
          <Button title="Tamper Events" variant="outlined" size="sm" color="destructive" onPress={cheats.tamper} />
        )}
        {cheats.tamperActive && (
          <Button title="Clear Tamper" variant="outlined" size="sm" onPress={cheats.clearTamper} />
        )}
      </Stack>
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
