import { Button, Stack, Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { CheatHandlers } from './use-cheat-handlers';
import type { NetworkControls } from './use-network-controls';

function NetworkButtons({ network }: { network: NetworkControls }) {
  const { t } = useLingui();
  const isPaused = network.isPaused.current;
  return (
    <Stack direction="horizontal" spacing={2} wrap>
      {!isPaused && (
        <Button
          title={t`Pause`}
          variant="outlined"
          size="sm"
          onPress={network.pause}
        />
      )}
      {isPaused && (
        <Button
          title={t`Resume`}
          variant="outlined"
          size="sm"
          onPress={network.resume}
        />
      )}
      <Button
        title={t`Drop next`}
        variant="outlined"
        size="sm"
        onPress={network.drop}
      />
      <Button
        title={t`Reset`}
        variant="outlined"
        size="sm"
        onPress={network.reset}
      />
      <Button
        title={t`Partition`}
        variant="outlined"
        size="sm"
        onPress={network.scenarioPartition}
      />
      <Button
        title={t`Timeout`}
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
  const { t } = useLingui();
  return (
    <Stack spacing={1}>
      <Text variant="caption" label={t`Replay / Fabrication`} />
      <Stack direction="horizontal" spacing={2} wrap>
        <Button
          title={t`Fabricate Commit`}
          variant="outlined"
          size="sm"
          color="destructive"
          onPress={cheats.fabricate}
        />
        <Button
          title={t`Replay Events`}
          variant="outlined"
          size="sm"
          color="destructive"
          onPress={cheats.replay}
        />
      </Stack>
    </Stack>
  );
}

function IdentityBypassButtons({ cheats }: { cheats: CheatHandlers }) {
  const { t } = useLingui();
  return (
    <Stack spacing={1}>
      <Text variant="caption" label={t`Identity / Authority Bypass`} />
      <Stack direction="horizontal" spacing={2} wrap>
        <Button
          title={t`X: non-authority trust_update`}
          variant="outlined"
          size="sm"
          color="destructive"
          onPress={cheats.unauthorizedTrustX}
        />
        <Button
          title={t`O: non-authority trust_update`}
          variant="outlined"
          size="sm"
          color="destructive"
          onPress={cheats.unauthorizedTrustO}
        />
      </Stack>
    </Stack>
  );
}

function ClockTamperingButtons({ cheats }: { cheats: CheatHandlers }) {
  const { t } = useLingui();
  return (
    <Stack spacing={1}>
      <Text variant="caption" label={t`Clock Tampering`} />
      <Stack direction="horizontal" spacing={2} wrap>
        <Button
          title={t`X: force TickClock`}
          variant="outlined"
          size="sm"
          color="destructive"
          onPress={cheats.forcedClockX}
        />
        <Button
          title={t`O: force TickClock`}
          variant="outlined"
          size="sm"
          color="destructive"
          onPress={cheats.forcedClockO}
        />
      </Stack>
    </Stack>
  );
}

function MitmButtons({ cheats }: { cheats: CheatHandlers }) {
  const { t } = useLingui();
  return (
    <Stack spacing={1}>
      <Text variant="caption" label={t`MITM Integrity`} />
      <Stack direction="horizontal" spacing={2} wrap>
        {!cheats.tamperActive && (
          <Button
            title={t`Tamper Events`}
            variant="outlined"
            size="sm"
            color="destructive"
            onPress={cheats.tamper}
          />
        )}
        {cheats.tamperActive && (
          <Button
            title={t`Clear Tamper`}
            variant="outlined"
            size="sm"
            onPress={cheats.clearTamper}
          />
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
  const { t } = useLingui();
  return (
    <Stack spacing={2}>
      <Text variant="label" label={t`Network Controls`} />
      <NetworkButtons network={network} />
      <Text variant="label" label={t`Wire Attacks (MITM)`} />
      <CheatButtons cheats={cheats} />
    </Stack>
  );
}
