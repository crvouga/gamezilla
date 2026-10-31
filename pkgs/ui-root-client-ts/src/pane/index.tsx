/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { componentId, dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type {
  RadiusToken,
  SurfaceTone,
} from '@pkgs/ui-root-shared-ts/token-names';
import type { JSX } from 'solid-js';
import { radiusClass, spaced, surfaceClass } from '../layout-classes';

/** Fill of a pane. */
export type PaneTone = Extract<
  SurfaceTone,
  'background' | 'surface' | 'muted' | 'transparent'
>;

export type PaneProps = {
  children?: JSX.Element | undefined;
  /** Share the parent's room with the sibling panes. Default `true`. */
  grow?: boolean | undefined;
  /** A hairline around the pane. */
  border?: boolean | undefined;
  /**
   * Clip the content to the pane. Default `true`; `false` for a chrome strip
   * whose tooltips hang below it.
   */
  clip?: boolean | undefined;
  /** Draw the hairline in the tint color (implies `border`). */
  focused?: boolean | undefined;
  /** A pointer went down inside the pane. */
  onActivate?: (() => void) | undefined;
  /** Fill. Default `transparent`. */
  tone?: PaneTone | undefined;
  /** Corner radius, for a pane that floats in a list (a notebook cell). */
  radius?: RadiusToken | undefined;
  /** Keep the pane mounted but out of the layout and the reading order. */
  hidden?: boolean | undefined;
  id?: string | undefined;
  'aria-label'?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
  /** More `data-*` attributes, keyed without the prefix. */
  dataSet?: ComponentDataSet | undefined;
};

function borderClass(pane: PaneProps): string | undefined {
  if (pane.focused === true) return 'border border-tint';
  return pane.border === true ? 'border border-border' : undefined;
}

function paneClass(pane: PaneProps): string {
  return spaced([
    'box',
    pane.clip === false ? undefined : 'overflow-hidden',
    pane.grow === false ? undefined : 'flex-1',
    surfaceClass(pane.tone ?? 'transparent'),
    radiusClass(pane.radius),
    borderClass(pane),
    pane.hidden === true ? 'hidden' : undefined,
  ]);
}

/**
 * `Pane` -- one region of a multi-pane tool layout (side-by-side columns of
 * a console, an editor beside its preview). It claims its share of the row
 * or column it sits in, never pushes the layout wider than it is, and clips
 * what it hosts, so an embedded app or a long log stays inside its column.
 *
 * - `border` draws a hairline around the pane; `focused` draws it in the
 *   tint color, marking the pane that receives the keyboard.
 * - `onActivate` runs when a pointer goes down anywhere inside the pane
 *   (focus follows the pointer); the press still reaches the control under
 *   it.
 * - `grow` (default `true`) shares the parent's room equally with the
 *   sibling panes; `false` keeps the pane at its content size (a chrome
 *   strip above the panes).
 * - `clip={false}` lets a chrome strip's tooltips hang below it.
 * - `radius` rounds a pane that sits in a list of panes (a notebook cell).
 * - `hidden` keeps a background pane mounted (its state, its scroll) while
 *   another one is shown.
 *
 * @example
 * ```tsx
 * <StackHorizontal grow overflow="hidden">
 *   <For each={clients()}>
 *     {(client) => (
 *       <Pane border focused={focused() === client.id} onActivate={() => focus(client.id)}>
 *         <EmbeddedFrame title={client.name} src={client.url} />
 *       </Pane>
 *     )}
 *   </For>
 * </StackHorizontal>
 * ```
 */
export function Pane(props: PaneProps): JSX.Element {
  return (
    <div
      class={paneClass(props)}
      id={props.id}
      aria-label={props['aria-label']}
      hidden={props.hidden === true ? true : undefined}
      data-testid={props.testId}
      data-component={componentId('Pane')}
      data-focused={props.focused === true ? 'true' : undefined}
      {...dataAttrs(props.dataSet)}
      onPointerDown={() => props.onActivate?.()}
    >
      {props.children}
    </div>
  );
}
