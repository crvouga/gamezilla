import { Trans } from '@lingui/solid/macro';
import { StatusDot } from '@pkgs/ui-root-client/status-dot';
import type { JSX } from 'solid-js';

/** Static "Live" pill (no props — miniplayer entries are always live). */
export function MiniplayerLiveBadge(): JSX.Element {
  return (
    <div class="box flex-row items-center gap-1 bg-surface-muted px-2 py-0.5 rounded-full">
      <StatusDot status="online" size={6} />
      <p class="text textCaption text-text-secondary">{<Trans>Live</Trans>}</p>
    </div>
  );
}
