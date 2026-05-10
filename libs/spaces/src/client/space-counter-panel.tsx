import { useSpaceDispatch, useSpaceSelector } from './use-space-room-selector';
import {
  CounterRoomAttr,
  Decrement,
  Increment,
} from '@gamezilla/spaces/shared/counter';
import { Box, Button, Text } from '@gamezilla/ui';
import {
  RoomMetaAttr,
  SPACE_ROOM_NAME,
  useRoomFromRegistry,
} from '@gamezilla/room';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

/**
 * Counter panel for a space. Reads shared room state via
 * {@link useSpaceSelector} under {@link SpaceRoomProvider}.
 */
export function SpaceCounterPanel(): ReactNode {
  const { t } = useLingui();
  const room = useRoomFromRegistry(SPACE_ROOM_NAME);
  const roomActive = room !== null;
  const count = useSpaceSelector(CounterRoomAttr.count.from);
  const isSynced = useSpaceSelector(RoomMetaAttr.isSynced.from);
  const dispatch = useSpaceDispatch();
  const increment = useCallback(() => {
    dispatch(Increment({}));
  }, [dispatch]);
  const decrement = useCallback(() => {
    dispatch(Decrement({}));
  }, [dispatch]);

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
          intent="neutral"
          onPress={decrement}
          disabled={!isSynced}
        />
        <Button title={t`Increment`} onPress={increment} disabled={!isSynced} />
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
