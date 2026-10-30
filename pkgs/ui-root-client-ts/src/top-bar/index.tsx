/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';

export type TopBarCenterAlign = 'start' | 'center' | 'end';
export type TopBarCenterPosition = 'absolute' | 'flex';

export type TopBarProps = {
  /** Slot pinned to the left edge (typically back/home + identity). */
  leading?: JSX.Element | undefined;
  /** Slot stretched between leading and trailing. */
  center?: JSX.Element | undefined;
  /** Slot pinned to the right edge (typically actions + overflow). */
  trailing?: JSX.Element | undefined;
  /** Cross-axis alignment for the center slot. Defaults to `'start'`. */
  centerAlign?: TopBarCenterAlign | undefined;
  /** Overlay (`absolute`, default) or in-flow (`flex`) centered slot. */
  centerPosition?: TopBarCenterPosition | undefined;
  /** Pad the top by `env(safe-area-inset-top)`. Default `true`. */
  safeAreaTop?: boolean | undefined;
  /** Draw the bottom hairline (content is scrolled under it). Default `true`. */
  divider?: boolean | undefined;
  dataSet?: ComponentDataSet | undefined;
};

const ALIGN_CLASS: Record<TopBarCenterAlign, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
};

// Side slots / overlay are pointer-transparent via the `.boxNone` class (its
// `> *` rule re-enables children) rather than inline `pointer-events:none`,
// which children would inherit.
const SIDE_SLOT_CLASS =
  'boxNone flex-1 flex-row items-center gap-2 min-w-0 z-3';

type SlotsProps = Pick<
  TopBarProps,
  'leading' | 'center' | 'trailing' | 'centerAlign' | 'centerPosition'
>;

/**
 * In flow, the trailing content is laid out as items of the row itself (no
 * wrapper), so the room is shared in one place. The center has a 96px basis
 * and takes all the room left over, so a long title truncates first; below
 * that basis an `ActionBar` in the trailing content gives up room (it
 * shrinks 1000x faster, collapsing into its More menu), and only then does
 * the title shrink further. Leading and fixed trailing controls never
 * shrink, so nothing overlaps.
 */
function FlexLayout(props: SlotsProps): JSX.Element {
  return (
    <>
      <Show when={props.leading !== undefined}>
        <div class="box shrink-0 flex-row items-center gap-2">
          {props.leading}
        </div>
      </Show>
      <div
        class="box grow shrink basis-24 min-w-0 flex-row items-center"
        classList={{
          [ALIGN_CLASS[props.centerAlign ?? 'start']]: true,
        }}
      >
        {props.center}
      </div>
      {props.trailing}
    </>
  );
}

function AbsoluteCenterLayout(props: SlotsProps): JSX.Element {
  return (
    <div class="box relative flex-1 min-w-0 self-stretch flex-row items-center">
      <div class={`box justify-start ${SIDE_SLOT_CLASS}`}>{props.leading}</div>
      <div class={`box justify-end ${SIDE_SLOT_CLASS}`}>{props.trailing}</div>
      <div
        class="box absolute inset-0 flex-row items-center justify-center z-2 px-12"
        classList={{ boxNone: true }}
      >
        <div class="box min-w-0 max-w-full">{props.center}</div>
      </div>
    </div>
  );
}

/**
 * `TopBar` -- header row with leading / center / trailing slots: one 52px
 * row on the `background` canvas, at every breakpoint, with 16px edges.
 * Titles sit left, after the 44px back control (`TopBarTitle`); icon
 * buttons in the side slots keep their own 40px+ hit areas. It sits above
 * the screen's scroller, so it stays put while the body scrolls.
 *
 * The bottom hairline (`border`) separates the bar from content scrolled
 * under it: `divider` (default `true`) draws it. `ScreenBase` passes whether
 * its body has scrolled, so a screen at rest has no line under its bar. The
 * edge is always reserved, so the bar never shifts by a pixel.
 *
 * `centerAlign="center"` overlays the center slot across the full width so a
 * title stays visually centered regardless of side-slot widths; pass
 * `centerPosition="flex"` to keep it in flow instead. In flow, the title
 * keeps the room first: trailing actions collapse into their More menu
 * before it truncates, and nothing ever paints over it.
 */
export function TopBar(props: TopBarProps): JSX.Element {
  const useAbsoluteCenter = () =>
    props.centerAlign === 'center' &&
    props.center !== undefined &&
    props.center !== null &&
    props.centerPosition !== 'flex';
  return (
    <header
      class="box shrink-0 bg-background border-b"
      classList={{
        safeTop: props.safeAreaTop !== false,
        'border-border': props.divider !== false,
        'border-transparent': props.divider === false,
      }}
      {...dataAttrs({
        component: 'TopBar',
        divider: props.divider === false ? 'none' : 'hairline',
        ...props.dataSet,
      })}
    >
      <div class="box flex-row items-center gap-2 px-4 w-full h-13">
        <Show when={useAbsoluteCenter()} fallback={<FlexLayout {...props} />}>
          <AbsoluteCenterLayout {...props} />
        </Show>
      </div>
    </header>
  );
}
