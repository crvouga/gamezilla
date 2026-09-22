/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { colorVar } from '../../theme';
import { EyeIcon } from '../icons';
import { Tooltip } from '../tooltip';

/**
 * Compact, game-agnostic marker for a read-only spectator surface. Keep this
 * in the design system so every game uses the same affordance and footprint.
 */
export function SpectatorIndicator(): JSX.Element {
  return (
    <Tooltip
      label={<Trans>Spectating — controls are disabled</Trans>}
      placement="bottom"
      dataSet={{ component: 'SpectatorIndicator' }}
    >
      <div
        class="box flex-row items-center gap-1 rounded-full px-2"
        aria-label="Spectating; controls are disabled"
        data-testid="spectator-indicator"
        style={{
          height: '24px',
          'background-color': colorVar('surfaceMuted'),
          color: colorVar('textSecondary'),
        }}
      >
        <EyeIcon size={14} color="textSecondary" />
        <span class="text textLabel text-text-secondary">
          <Trans>Spectating</Trans>
        </span>
      </div>
    </Tooltip>
  );
}
