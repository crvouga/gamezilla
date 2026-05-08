import { useCurrentSpaceIds } from '@gamezilla/client/spaces/use-current-space-ids';
import { JsonView } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

/** Current-spaces snapshot for the space debug modal. */
export function SpaceDebugCurrentSpacesSection(): ReactNode {
  const { entries, isLoading } = useCurrentSpaceIds();
  return (
    <JsonView
      label={<Trans>currentSpaces</Trans>}
      value={{ entries, isLoading }}
    />
  );
}
