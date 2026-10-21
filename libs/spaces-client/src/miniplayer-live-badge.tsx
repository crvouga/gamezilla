import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client/badge';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import type { JSX } from 'solid-js';

/**
 * "Live" pill on a miniplayer row (its entries are always live), centered on
 * the row: the badge itself sits at the start of its box.
 */
export function MiniplayerLiveBadge(): JSX.Element {
  return (
    <StackVertical>
      <Badge label={<Trans>Live</Trans>} intent="neutral" dot="online" />
    </StackVertical>
  );
}
