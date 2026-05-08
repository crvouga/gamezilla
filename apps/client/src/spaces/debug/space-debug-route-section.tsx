import { JsonView } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceDebugRouteSectionProps = {
  spaceId: string;
};

/** Route param snapshot for the space debug modal. */
export function SpaceDebugRouteSection({
  spaceId,
}: SpaceDebugRouteSectionProps): ReactNode {
  return <JsonView label={<Trans>route</Trans>} value={{ spaceId }} />;
}
