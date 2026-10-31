/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { flexContainerClass, spaced, surfaceClass } from '../layout-classes';
import type { Justify } from '../layout-props';
import { spacingClass } from '../space-classes';

/** Fill of the bar. */
export type ToolbarTone = 'surface' | 'muted' | 'background';

/** Side of the bar that carries the hairline. */
export type ToolbarEdge = 'bottom' | 'top' | 'none';

/** Rhythm of the bar: a dense tool or a page header. */
export type ToolbarDensity = 'compact' | 'regular';

export type ToolbarProps = {
  children?: JSX.Element | undefined;
  /** Default `muted`. */
  tone?: ToolbarTone | undefined;
  /** Default `bottom`. */
  edge?: ToolbarEdge | undefined;
  /** Default `compact`. */
  density?: ToolbarDensity | undefined;
  /** Main-axis distribution. Default `start`. */
  justify?: Justify | undefined;
  /** Let the controls wrap onto further lines. */
  wrap?: boolean | undefined;
  role?: 'toolbar' | 'group' | undefined;
  'aria-label'?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

const EDGE: Readonly<Record<ToolbarEdge, string | undefined>> = {
  bottom: 'border-b border-border',
  top: 'border-t border-border',
  none: undefined,
};

const DENSITY: Readonly<Record<ToolbarDensity, string>> = {
  compact: spacingClass({ gap: 'xs', paddingX: 'sm', paddingY: 'xs' }),
  regular: spacingClass({ gap: 'sm', paddingX: 'lg', paddingY: 'sm' }),
};

function toolbarClass(bar: ToolbarProps): string {
  return spaced([
    'box flex-row min-w-0',
    flexContainerClass({
      align: 'center',
      justify: bar.justify,
      wrap: bar.wrap,
    }),
    surfaceClass(bar.tone ?? 'muted'),
    EDGE[bar.edge ?? 'bottom'],
    DENSITY[bar.density ?? 'compact'],
  ]);
}

/**
 * `Toolbar` -- the dense bar along one edge of a tool pane: a caption and a
 * row of icon actions on a quiet fill, set off from the content it drives by
 * one hairline. Developer consoles, editors and inspectors put one above
 * (or below) each pane; screens use `TopBar`.
 *
 * - `edge` is the side the hairline sits on: `bottom` for a bar above its
 *   content (the default), `top` for a bar below it, `none` for a bar that
 *   is already bounded.
 * - `density="compact"` (default) is the 4px / 8px rhythm of a dense tool;
 *   `regular` is the 8px / 16px rhythm of a page header.
 * - Children lay out in one row, centered on the cross axis. Give the label
 *   `grow` (inside a `StackHorizontal grow`) to push the actions to the end.
 *
 * `role="toolbar"` promises arrow-key navigation between the controls; leave
 * `role` unset (or `group`) for a bar of ordinary tab stops.
 *
 * @example
 * ```tsx
 * <Toolbar aria-label={t`Notebook`}>
 *   <StackHorizontal grow>
 *     <P variant="footnote" lines={1}>{t`SQL notebook`}</P>
 *   </StackHorizontal>
 *   <IconButton label={t`Run all`} size={28} onClick={runAll}>…</IconButton>
 * </Toolbar>
 * ```
 */
export function Toolbar(props: ToolbarProps): JSX.Element {
  return (
    <div
      class={toolbarClass(props)}
      role={props.role}
      aria-label={props['aria-label']}
      data-testid={props.testId}
      data-component={componentId('Toolbar')}
    >
      {props.children}
    </div>
  );
}
