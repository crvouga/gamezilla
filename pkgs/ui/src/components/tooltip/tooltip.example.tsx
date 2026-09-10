/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { IconButton } from '../icon-button';
import { SettingsIcon } from '../icons';

export default function TooltipExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption text-text-secondary">
        {'Hover icon buttons to see their labels.'}
      </p>
      <div class="box flex-row gap-4 items-center">
        <IconButton
          label="Settings"
          background="surface"
          onClick={() => undefined}
        >
          <SettingsIcon size={18} />
        </IconButton>
      </div>
    </ExampleRoot>
  );
}
