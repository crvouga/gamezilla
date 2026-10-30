/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';

/**
 * `StatusDot` -- small colored circle indicating a status.
 *
 * @example
 * ```tsx
 * <StatusDot status="online" />
 * <StatusDot status="offline" size={12} />
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';

export type StatusDotStatus = 'online' | 'offline' | 'warning' | 'pending';

export type StatusDotProps = {
  /** The status the dot paints. Unset when `color` names the dot instead. */
  status?: StatusDotStatus | undefined;
  /**
   * A color that is data, not a role: the participant color that marks one
   * person's arrows and suggestions. Wins over `status`.
   */
  color?: string | undefined;
  /** Diameter in pixels. Defaults to 10. */
  size?: number | undefined;
  /** Accessible name; omitted dots are decorative (`aria-hidden`). */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const DEFAULT_SIZE = 10;

export function StatusDot(props: StatusDotProps): JSX.Element {
  const size = () => props.size ?? DEFAULT_SIZE;
  return (
    <span
      class="statusDot inline-block shrink-0 rounded-full"
      {...dataAttrs({
        component: 'StatusDot',
        ...(props.status === undefined ? {} : { status: props.status }),
        ...props.dataSet,
      })}
      style={{
        width: cssPx(size()),
        height: cssPx(size()),
        'background-color': props.color,
      }}
      role={props.label === undefined ? undefined : 'img'}
      aria-label={props.label}
      aria-hidden={props.label === undefined ? true : undefined}
    />
  );
}
