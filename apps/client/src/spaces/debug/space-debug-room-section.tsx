import { useSpaceSelector } from '@gamezilla/client/spaces/room/use-space-room-selector';
import { JsonView } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

/** Room snapshot for the space debug modal. */
export function SpaceDebugRoomSection(): ReactNode {
  const state = useSpaceSelector((state) => state);
  return <JsonView label={<Trans>room</Trans>} value={state} />;
}
