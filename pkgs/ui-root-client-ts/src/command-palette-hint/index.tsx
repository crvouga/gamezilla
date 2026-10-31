/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

export type CommandPaletteHintProps = {
  legend?: JSX.Element | undefined;
};

/**
 * `CommandPaletteHint` -- footer legend under the palette list
 * (`↑ ↓ navigate · ↵ run · Esc close`). Pass `legend` to override.
 */
export function CommandPaletteHint(
  props: CommandPaletteHintProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <div class="box px-3 pb-2 pt-1" data-component="CommandPaletteHint">
      <p class="text textCaption text-text-secondary">
        {props.legend ?? t`↑ ↓ navigate · ↵ run · Esc close · Tab next`}
      </p>
    </div>
  );
}
