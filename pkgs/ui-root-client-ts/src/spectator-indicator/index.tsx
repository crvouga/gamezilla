/** @jsxImportSource solid-js */

import { Trans, useLingui } from '@lingui/solid/macro';
import { type JSX, Show } from 'solid-js';
import { GameWatcherCount } from '../game-watching/index';
import { EyeIcon } from '../icons';
import { Tooltip } from '../tooltip/index';

/** How many people are watching, and what a listener hears for it. */
export type SpectatorCount = { value: number; label: string };

/**
 * Compact, game-agnostic marker for a read-only spectator surface: a sunken
 * (`surfaceMuted`) pill with an eye and "Spectating". Keep this in the
 * design system so every game uses the same affordance and footprint. With
 * `count`, the number watching follows it as a sibling `GameWatcherCount`.
 */
export function SpectatorIndicator(props: {
  count?: SpectatorCount | undefined;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Tooltip
        label={<Trans>Spectating — controls are disabled</Trans>}
        placement="bottom"
        dataSet={{ component: 'SpectatorIndicator' }}
      >
        <div
          class="box flex-row items-center gap-1 rounded-full px-2 h-6 bg-surface-muted"
          aria-label={t`Spectating; controls are disabled`}
          data-testid="spectator-indicator"
        >
          <EyeIcon size={16} color="textSecondary" />
          <span class="text textLabel text-text-secondary whitespace-nowrap">
            <Trans>Spectating</Trans>
          </span>
        </div>
      </Tooltip>
      <Show when={props.count}>
        {(count) => (
          <GameWatcherCount value={count().value} label={count().label} />
        )}
      </Show>
    </>
  );
}
