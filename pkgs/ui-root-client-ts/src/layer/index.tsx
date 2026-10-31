/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { directionClass, flexContainerClass, spaced } from '../layout-classes';
import type { Align, Direction, Justify, RegionRole } from '../layout-props';
import type { Responsive } from '../responsive';
import type { SpacingProps } from '../space-classes';
import { spacingClass } from '../space-classes';

/** What the layer covers. */
export type LayerInset = 'parent' | 'viewport';

/** `base` stays in document order, `raised` paints above its siblings. */
export type LayerZ = 'base' | 'raised';

export type LayerProps = SpacingProps & {
  inset: LayerInset;
  /** The main axis of the children. Default `vertical`. */
  direction?: Responsive<Direction> | undefined;
  align?: Align | undefined;
  justify?: Justify | undefined;
  /** Presses on the empty area reach the content underneath. */
  passThrough?: boolean | undefined;
  /** Default `base`. */
  z?: LayerZ | undefined;
  children?: JSX.Element | undefined;
  role?: RegionRole | undefined;
  'aria-label'?: string | undefined;
  'aria-hidden'?: boolean | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

const INSET: Readonly<Record<LayerInset, string>> = {
  parent: 'absolute inset-0',
  viewport: 'fixed inset-0',
};

const Z: Readonly<Record<LayerZ, string>> = {
  base: 'z-0',
  raised: 'z-1',
};

function layerClass(layer: LayerProps): string {
  return spaced([
    'box',
    INSET[layer.inset],
    Z[layer.z ?? 'base'],
    directionClass(layer.direction ?? 'vertical'),
    flexContainerClass(layer),
    spacingClass(layer),
    layer.passThrough === true ? 'boxNone' : undefined,
  ]);
}

/**
 * `Layer` -- a box laid over other content: the parent's whole area
 * (`inset="parent"`, absolutely placed against the nearest positioned
 * ancestor, which every `Stack*` and `Surface` is) or the whole viewport
 * (`inset="viewport"`). It arranges its children like a stack, so a centered
 * badge over a board is `align="center" justify="center"`.
 *
 * - `passThrough` lets presses on the empty area reach what is underneath;
 *   the layer's own children still take them.
 * - `z="raised"` lifts the layer above later siblings in the same stacking
 *   context. App-level overlays (menus, dialogs) are not layers:
 *   they have their own hosts.
 *
 * Screens use it instead of writing `absolute inset-0` classes.
 *
 * @example
 * ```tsx
 * <StackVertical>
 *   <GameBoard … />
 *   <Layer inset="parent" align="center" justify="center" passThrough>
 *     <Badge label={t`Your move`} />
 *   </Layer>
 * </StackVertical>
 * ```
 */
export function Layer(props: LayerProps): JSX.Element {
  return (
    <div
      class={layerClass(props)}
      data-testid={props.testId}
      data-component={componentId('Layer')}
      data-inset={props.inset}
      role={props.role}
      aria-label={props['aria-label']}
      aria-hidden={props['aria-hidden']}
    >
      {props.children}
    </div>
  );
}
