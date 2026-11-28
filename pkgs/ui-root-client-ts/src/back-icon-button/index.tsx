/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { IconButton } from '../icon-button/index';
import { ChevronLeftIcon } from '../icons';

export type BackIconButtonProps = {
  onClick: () => void;
  /** Diameter in pixels. Defaults to 40. */
  size?: number | undefined;
  /** Plate color token. Defaults to none (transparent). */
  background?: ColorTokenName | undefined;
  /** Label override. Defaults to localized "Back". */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** 20px glyph in the default 40px disc, the header icon size. */
const ICON_SIZE = 20;

/**
 * `BackIconButton` -- icon button rendering a left chevron: a 20px outline
 * glyph in text color in a 40px disc, unfilled so the header stays quiet;
 * the hover / press tint shows the hit target.
 *
 * Centralizes the "back" affordance so every screen uses the same icon,
 * size, hit target, and accessible name.
 *
 * @example
 * ```tsx
 * <BackIconButton onClick={onBack} />
 * ```
 */
export function BackIconButton(props: BackIconButtonProps): JSX.Element {
  const { t } = useLingui();
  const size = (): number => props.size ?? 40;
  const label = (): string => props.label ?? t`Back`;
  return (
    <IconButton
      size={size()}
      background={props.background}
      onClick={() => props.onClick()}
      label={label()}
      aria-label={label()}
      dataSet={{ component: 'BackIconButton', ...props.dataSet }}
    >
      <ChevronLeftIcon
        size={ICON_SIZE}
        color="text"
      />
    </IconButton>
  );
}
