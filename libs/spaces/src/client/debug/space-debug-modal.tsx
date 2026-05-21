/**
 * `SpaceDebugModal` — developer-facing inspector for the space detail screen.
 *
 * Three tabs of raw, un-normalized state: the patch-db space entity, the
 * shared-room state for the same space, and the patch-db space-membership
 * entities scoped to this space.
 *
 * The surface is given a fixed `bodyHeight` so the modal does not jump in
 * size when the user switches tabs; long payloads scroll inside `JsonView`.
 */

import { useSpaceRoomSelector } from '../room/use-space-room-selector';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceMembershipAttr,
} from '@libs/spaces/shared/space-entities';
import { Box, JsonView, ResponsiveSurface, SegmentedControl } from '@pkgs/ui';
import { useEntity, useQuery } from '@pkgs/patch-db/react';
import { Trans } from '@lingui/react/macro';
import { useState, type ReactNode } from 'react';

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
  const space = useEntity(SPACE_ENTITY_TYPE, spaceId);
  const room = useSpaceRoomSelector((state) => state);
  const memberships = useQuery({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    where: {
      type: '=',
      attribute: SpaceMembershipAttr.spaceId.key,
      value: spaceId,
    },
  });

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={<Trans>Space debug</Trans>}
      maxWidth={720}
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
