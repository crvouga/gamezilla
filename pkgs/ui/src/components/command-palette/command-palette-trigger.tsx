/** @jsxImportSource solid-js */
/**
 * `CommandPaletteTrigger` -- icon button that toggles the command palette.
 * Use alongside the keyboard shortcut (or instead of it on touch devices).
 */

import { useLingui } from '@lingui/solid/macro';
import type { LocalizedString } from '@pkgs/i18n/localized-string';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { ComponentDataSet } from '../../component-id';
import { IconButton } from '../icon-button';
import { type IconComponent, ListChecksIcon } from '../icons';
import { useCommandPalette } from './use-command-palette';

export type CommandPaletteTriggerProps = {
  /** Icon component from the design-system registry. Defaults to ListChecksIcon. */
  icon?: IconComponent | undefined;
  /** Pixel size of the tappable area. Defaults to 40. */
  size?: number | undefined;
  'aria-label'?: LocalizedString | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function CommandPaletteTrigger(
  props: CommandPaletteTriggerProps
): JSX.Element {
  const { t } = useLingui();
  const palette = useCommandPalette();
  return (
    <IconButton
      size={props.size ?? 40}
      label={props['aria-label'] ?? t`Open command palette`}
      onClick={() => palette.toggle()}
      aria-haspopup="dialog"
      aria-expanded={palette.isOpen()}
      dataSet={{ component: 'CommandPaletteTrigger', ...props.dataSet }}
    >
      <Dynamic
        component={props.icon ?? ListChecksIcon}
        size={22}
        color="icon"
      />
    </IconButton>
  );
}
