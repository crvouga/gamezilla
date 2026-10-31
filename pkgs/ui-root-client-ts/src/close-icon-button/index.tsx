/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { IconButton } from '../icon-button/index';
import { XIcon } from '../icons';

export type CloseIconButtonProps = {
  onClick: () => void;
  /** Diameter in pixels. Defaults to 40. */
  size?: number | undefined;
  /** Plate color token. Defaults to none (transparent). */
  background?: ColorTokenName | undefined;
  /** Label override. Defaults to localized "Close". */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** 24px glyph in the default 40px disc, the header icon size. */
const ICON_SIZE_RATIO = 0.6;

/**
 * `CloseIconButton` -- circular icon button rendering an X.
 *
 * Centralizes the "close" affordance for surfaces (modals, sheets) so every
 * dismiss control uses the same icon, size and accessible name: a plain 24px
 * X in text color in a 40px disc, like the header controls; the press tint
 * shows the hit area. Pass `background="surfaceMuted"` to put it on a plate
 * over media.
 *
 * @example
 * ```tsx
 * <CloseIconButton onClick={onClose} />
 * ```
 */
export function CloseIconButton(props: CloseIconButtonProps): JSX.Element {
  const { t } = useLingui();
  const size = (): number => props.size ?? 40;
  const label = (): string => props.label ?? t`Close`;
  return (
    <IconButton
      size={size()}
      background={props.background}
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
