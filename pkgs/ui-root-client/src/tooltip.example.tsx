/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { IconButton } from './icon-button';
import { BellIcon, SettingsIcon, UserIcon } from './icons';
import { SchemePreview } from './scheme-preview';
import type { TooltipPlacement } from './tooltip';
import { Tooltip } from './tooltip';

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
      <SchemePreview>
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
      </SchemePreview>
    </ExampleRoot>
  );
}
