import { Box, Button, Text } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';

import type { SpaceRoomUiState } from './use-space-room';

export function SpaceCounterPanel({ room }: { room: SpaceRoomUiState }) {
  const { t } = useLingui();
  const { count, increment, decrement, isSynced, roomActive } = room;

  if (!roomActive) {
    return (
      <Box sx={{ py: 2 }}>
        <Text
          variant="body"
          sx={{ color: 'textSecondary' }}
          label={
            <Trans>
              Counter unavailable — sign in and open this space on the device
              where you created it to host, or wait for the host to come online.
            </Trans>
          }
        />
      </Box>
    );
  }

  return (
    <Box sx={{ gap: 3, py: 2 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label={<Trans>Shared counter</Trans>}
      />
      <Text variant="heading" label={String(count)} />
      <Box sx={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
        <Button
          title={t`Decrement`}
          variant="outlined"
          onPress={decrement}
          disabled={!isSynced}
        />
        <Button
          title={t`Increment`}
          variant="solid"
          onPress={increment}
          disabled={!isSynced}
        />
      </Box>
      {!isSynced ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={<Trans>Connecting to room…</Trans>}
        />
      ) : null}
    </Box>
  );
}
