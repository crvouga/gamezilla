import { useSpaceRoomSelector } from '../room/use-space-room-selector';
import { Box, JsonView, ResponsiveSurface, SegmentedControl } from '@pkgs/ui';
import { useWatchOne, useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';
import { Trans } from '@lingui/react/macro';
import { useState, type ReactNode } from 'react';

import {
  SPACE_DEBUG_MEMBERSHIPS_SQL,
  SPACE_DEBUG_ROW_SQL,
} from './space-debug-queries';

export type SpaceDebugModalProps = {
  visible: boolean;
  onClose: () => void;
  spaceId: string;
};

type Tab = 'space' | 'room' | 'memberships';

const TAB_BODY_HEIGHT = 480;

export function SpaceDebugModal({
  visible,
  onClose,
  spaceId,
}: SpaceDebugModalProps): ReactNode {
  const [tab, setTab] = useState<Tab>('space');
  const { row: space } = useWatchOne<Record<string, unknown>>(
    SPACE_DEBUG_ROW_SQL,
    [spaceId]
  );
  const room = useSpaceRoomSelector((state) => state);
  const { rows: memberships } = useWatchQuery<Record<string, unknown>>(
    SPACE_DEBUG_MEMBERSHIPS_SQL,
    [spaceId]
  );

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={<Trans>Space debug</Trans>}
      size="large"
      bodyHeight={TAB_BODY_HEIGHT}
    >
      <Box sx={{ gap: 3 }}>
        <SegmentedControl<Tab>
          segments={[
            { key: 'space', label: 'space' },
            { key: 'room', label: 'room' },
            { key: 'memberships', label: 'memberships' },
          ]}
          selected={tab}
          onSelect={setTab}
        />
        {tab === 'space' ? (
          <JsonView value={space} maxHeight={TAB_BODY_HEIGHT} />
        ) : null}
        {tab === 'room' ? (
          <JsonView value={room} maxHeight={TAB_BODY_HEIGHT} />
        ) : null}
        {tab === 'memberships' ? (
          <JsonView value={memberships} maxHeight={TAB_BODY_HEIGHT} />
        ) : null}
      </Box>
    </ResponsiveSurface>
  );
}
