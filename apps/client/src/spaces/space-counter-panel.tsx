import { Box, Button, Text } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';

import { useSpaceRoom } from './use-space-room';

export function SpaceCounterPanel({ spaceId }: { spaceId: string | undefined }) {
  const { t } = useLingui();
  const { count, increment, decrement, isSynced, roomActive } =
    useSpaceRoom(spaceId);

  if (!roomActive) {
    return (
      <Box sx={{ py: 2 }}>
        <Text
          variant="body"
          sx={{ color: 'textSecondary' }}
          label={
            <Trans>
              Realtime counter will appear once this space is upgraded for
              multiplayer sync.
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
