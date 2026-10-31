/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type {
  RadiusToken,
  SurfaceTone,
} from '@pkgs/ui-root-shared-ts/token-names';
import type { JSX } from 'solid-js';
import { bindDataSet } from '../data-set-binding';
import type { ElementTargetProps } from '../element-targets';
import { bindElementTargets } from '../element-targets';
import {
  directionClass,
  flexContainerClass,
  flexItemClass,
  radiusClass,
  spaced,
  surfaceClass,
} from '../layout-classes';
import type {
  Direction,
  FlexContainerProps,
  FlexItemProps,
  RegionProps,
} from '../layout-props';
import type { Responsive } from '../responsive';
import type { SpacingProps } from '../space-classes';
import { spacingClass } from '../space-classes';

/** Everything a layout box accepts. */
export type LayoutProps = SpacingProps &
  FlexItemProps &
  FlexContainerProps &
  RegionProps &
  ElementTargetProps & {
    /**
     * `static` stops the box anchoring absolutely placed descendants.
     * Default `relative`.
     */
    position?: 'static' | 'relative' | undefined;
    children?: JSX.Element | undefined;
  };

/** What a painted box adds. */
export type PaintProps = {
  /** Fill role. */
  tone?: SurfaceTone | undefined;
  /** Corner radius by hierarchy. */
  radius?: RadiusToken | undefined;
  /** A hairline in the `border` color on all four sides. */
  border?: boolean | undefined;
};

export type LayoutHostProps = {
  /** The component's name, written to `data-component`. */
  name: string;
  direction: Responsive<Direction>;
  /** The public props of the component this host renders. */
  of: LayoutProps & PaintProps;
  /** Fill the box (a `Surface`); a stack never paints. */
  painted?: boolean | undefined;
};

function paintClass(paint: PaintProps): string {
  return spaced([
    surfaceClass(paint.tone ?? 'surface'),
    radiusClass(paint.radius),
    paint.border === true ? 'border border-border' : undefined,
  ]);
}

function hostClass(host: LayoutHostProps): string {
  const layout = host.of;
  return spaced([
    'box',
    host.direction === 'vertical' ? undefined : directionClass(host.direction),
    flexContainerClass(layout),
    flexItemClass(layout),
    spacingClass(layout),
    layout.position === 'static' ? 'static' : undefined,
    layout.hidden === true ? 'hidden' : undefined,
    host.painted === true ? paintClass(layout) : undefined,
  ]);
}

/**
 * The one `<div>` behind `Stack*` and `Surface`: a flex box that lays its
 * children out from token props and writes every attribute by name.
 * Design-system internal; screens compose `Stack*` and `Surface`.
 */
export function LayoutHost(props: LayoutHostProps): JSX.Element {
  return (
    <div
      ref={(element) => {
        bindElementTargets(element, props.of);
        bindDataSet(element, props.of);
      }}
      class={hostClass(props)}
      id={props.of.id}
      data-testid={props.of.testId}
      data-component={componentId(props.name)}
      role={props.of.role}
      aria-label={props.of['aria-label']}
      aria-labelledby={props.of['aria-labelledby']}
      aria-describedby={props.of['aria-describedby']}
      aria-live={props.of['aria-live']}
      aria-atomic={props.of['aria-atomic']}
      aria-busy={props.of['aria-busy']}
      aria-hidden={props.of['aria-hidden']}
      inert={props.of.inert === true ? true : undefined}
      hidden={props.of.hidden === true ? true : undefined}
    >
      {props.of.children}
    </div>
  );
}
