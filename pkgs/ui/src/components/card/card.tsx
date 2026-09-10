/** @jsxImportSource solid-js */
/**
 * `Card` -- bordered surface with optional elevation lift. The background is
 * the elevation token (`--ui-elevation-N`), which equals `surface` at level 1
 * in light schemes and lifts progressively in dark schemes.
 */

import { type JSX, splitProps } from 'solid-js';
import { dataAttrs } from '../../component-id';
import type { ElevationLevel } from '../../theme';
import { type DivBoxProps, joinClass } from '../box';

export type CardProps = DivBoxProps & {
  /** Elevation 0-5. Defaults to 1. */
  elevation?: ElevationLevel | undefined;
};

export function Card(props: CardProps): JSX.Element {
  const [local, rest] = splitProps(props, ['elevation', 'class', 'dataSet']);
  const level = () => local.elevation ?? 1;
  return (
    <div
      class={joinClass(
        'box rounded-[14px] border border-solid border-border',
        `bg-elevation-${level()}`,
        local.class
      )}
      {...dataAttrs({ component: 'Card', ...local.dataSet })}
      {...rest}
    />
  );
}
