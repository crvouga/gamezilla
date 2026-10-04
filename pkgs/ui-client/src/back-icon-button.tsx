/** @jsxImportSource solid-js */
/**
 * `BackIconButton` -- circular icon button rendering a mirrored chevron.
 *
 * Centralizes the "back" affordance so every screen uses the same icon,
 * size, hit target, and accessible name.
 *
 * @example
 * ```tsx
 * <BackIconButton onClick={onBack} />
 * ```
 */

import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { IconButton } from './icon-button';
import { ChevronLeftIcon } from './icons';

export type BackIconButtonProps = {
  onClick: () => void;
  /** Diameter in pixels. Defaults to 40. */
  size?: number | undefined;
  /** Background color token or raw color. Defaults to `'surface'`. */
  background?: string | undefined;
  /** Label override. Defaults to localized "Back". */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const ICON_SIZE_RATIO = 0.5;

export function BackIconButton(props: BackIconButtonProps): JSX.Element {
  const { t } = useLingui();
  const size = (): number => props.size ?? 40;
  const label = (): string => props.label ?? t`Back`;
  return (
    <IconButton
      size={size()}
      background={props.background ?? 'surface'}
      onClick={() => props.onClick()}
      label={label()}
      aria-label={label()}
      dataSet={{ component: 'BackIconButton', ...props.dataSet }}
    >
      <ChevronLeftIcon
        size={Math.round(size() * ICON_SIZE_RATIO)}
        color="text"
      />
    </IconButton>
  );
}
