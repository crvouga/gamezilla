/** @jsxImportSource @solidjs/web */

import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dynamic, type JSX } from '@solidjs/web';
import type { IconComponent } from '../create-icon/index';
import { IconButton } from '../icon-button/index';
import { ListChecksIcon } from '../icons';
import { useCommandPalette } from '../use-command-palette';

export type CommandPaletteTriggerProps = {
  /** Icon component from the design-system registry. Defaults to ListChecksIcon. */
  icon?: IconComponent | undefined;
  /** Pixel size of the tappable area. Defaults to 40. */
  size?: number | undefined;
  'aria-label'?: LocalizedString | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `CommandPaletteTrigger` -- icon button that toggles the command palette.
 * Use alongside the keyboard shortcut (or instead of it on touch devices).
 */
export function CommandPaletteTrigger(
  props: CommandPaletteTriggerProps
): JSX.Element {
  const { t } = useLingui();
  const palette = useCommandPalette();
  const TriggerIcon = dynamic(() => props.icon ?? ListChecksIcon);
  return (
    <IconButton
      size={props.size ?? 40}
      label={props['aria-label'] ?? t`Open command palette`}
      onClick={() => palette.toggle()}
      aria-haspopup="dialog"
      aria-expanded={palette.isOpen()}
      dataSet={{ component: 'CommandPaletteTrigger', ...props.dataSet }}
    >
      <TriggerIcon size={22} color="icon" />
    </IconButton>
  );
}
