/** @jsxImportSource @solidjs/web */

import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  BellIcon,
  SettingsIcon,
  UserIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { TooltipPlacement } from '@pkgs/ui-root-client-ts/tooltip';
import { Tooltip } from '@pkgs/ui-root-client-ts/tooltip';
import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const PLACEMENTS: readonly TooltipPlacement[] = [
  'bottom',
  'top',
  'bottom-start',
  'bottom-end',
];

export default function TooltipExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'Hover an icon button, or reach it with Tab, to see its label. Escape hides it.'
        }
      </p>

      <div class="box flex-row flex-wrap gap-6 items-center py-8">
        <For each={PLACEMENTS}>
          {(placement) => (
            <IconButton
              label={`Settings (${placement})`}
              tooltip="default"
              tooltipPlacement={placement}
              onClick={() => undefined}
            >
              <SettingsIcon size={24} />
            </IconButton>
          )}
        </For>
        <IconButton
          label="Account"
          tooltip="default"
          tooltipFloating
          onClick={() => undefined}
        >
          <UserIcon size={24} />
        </IconButton>
        <Tooltip label="A longer label wraps onto a second line before it clamps.">
          <IconButton label="Alerts" tooltip="none" onClick={() => undefined}>
            <BellIcon size={24} />
          </IconButton>
        </Tooltip>
      </div>
    </ExampleRoot>
  );
}
