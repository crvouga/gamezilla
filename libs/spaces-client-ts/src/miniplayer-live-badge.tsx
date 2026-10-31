import { LiveBadge } from '@pkgs/ui-root-client-ts/badge';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';

/**
 * "LIVE" tag on a miniplayer row (its entries are always live), centered on
 * the row: the badge itself sits at the start of its box.
 */
export function MiniplayerLiveBadge(): JSX.Element {
  return (
    <StackVertical>
      <LiveBadge />
    </StackVertical>
  );
}
