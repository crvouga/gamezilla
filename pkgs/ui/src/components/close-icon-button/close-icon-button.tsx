/** @jsxImportSource solid-js */
/**
 * `CloseIconButton` -- circular icon button rendering an X.
 *
 * Centralizes the "close" affordance for surfaces (modals, sheets) so every
 * dismiss control uses the same icon, size, paper fill, and accessible name.
 *
 * @example
 * ```tsx
 * <CloseIconButton onClick={onClose} />
 * ```
 */

import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { IconButton } from '../icon-button';
import { XIcon } from '../icons';

export type CloseIconButtonProps = {
  onClick: () => void;
  /** Diameter in pixels. Defaults to 44. */
  size?: number | undefined;
  /** Background color token or raw color. Defaults to `'surface'`. */
  background?: string | undefined;
  /** Label override. Defaults to localized "Close". */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const ICON_SIZE_RATIO = 0.5;

export function CloseIconButton(props: CloseIconButtonProps): JSX.Element {
  const { t } = useLingui();
  const size = (): number => props.size ?? 44;
  const label = (): string => props.label ?? t`Close`;
  return (
    <IconButton
      size={size()}
      background={props.background ?? 'surface'}
      onClick={() => props.onClick()}
      label={label()}
      aria-label={label()}
      tooltip="none"
      dataSet={{ component: 'CloseIconButton', ...props.dataSet }}
    >
      <XIcon size={Math.round(size() * ICON_SIZE_RATIO)} color="text" />
    </IconButton>
  );
}
