/** @jsxImportSource solid-js */
/**
 * `TopBar` -- header row with leading / center / trailing slots.
 *
 * `centerAlign="center"` overlays the center slot across the full width so a
 * title stays visually centered regardless of side-slot widths; pass
 * `centerPosition="flex"` to keep it in flow instead.
 */

import { type JSX, Show } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import {
  getTopBarContentHeight,
  TOP_BAR_CONTENT_HEIGHT_MOBILE,
  useThemeLayout,
} from '../../theme';

export const TOP_BAR_CONTENT_HEIGHT = TOP_BAR_CONTENT_HEIGHT_MOBILE;

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
  'boxNone flex-1 flex-row items-center gap-2 min-w-0 z-[3]';

type SlotsProps = Pick<
  TopBarProps,
  'leading' | 'center' | 'trailing' | 'centerAlign' | 'centerPosition'
>;

function FlexLayout(props: SlotsProps): JSX.Element {
  return (
    <>
      <Show when={props.leading !== undefined}>
        <div class="box shrink-0 flex-row items-center gap-2">
          {props.leading}
        </div>
      </Show>
      <Show when={props.center !== undefined && props.center !== null}>
        <div
          class="box flex-1 min-w-0 flex-row items-center"
          classList={{
            [String(ALIGN_CLASS[props.centerAlign ?? 'start'])]: true,
          }}
        >
          {props.center}
        </div>
      </Show>
      <Show when={props.trailing !== undefined && props.trailing !== null}>
        <div class="box flex-1 min-w-0 self-stretch flex-row items-center justify-end gap-2">
          {props.trailing}
        </div>
      </Show>
    </>
  );
}

function AbsoluteCenterLayout(props: SlotsProps): JSX.Element {
  return (
    <div class="box relative flex-1 min-w-0 self-stretch flex-row items-center">
      <div class={`box justify-start ${SIDE_SLOT_CLASS}`}>{props.leading}</div>
      <div class={`box justify-end ${SIDE_SLOT_CLASS}`}>{props.trailing}</div>
      <div
        class="box absolute inset-0 flex-row items-center justify-center z-[2]"
        classList={{ boxNone: true }}
      >
        <div class="box min-w-0">{props.center}</div>
      </div>
    </div>
  );
}

export function TopBar(props: TopBarProps): JSX.Element {
  const layout = useThemeLayout();
  const contentHeight = () => getTopBarContentHeight(layout.breakpoint());
  const useAbsoluteCenter = () =>
    props.centerAlign === 'center' &&
    props.center !== undefined &&
    props.center !== null &&
    props.centerPosition !== 'flex';
  return (
    <header
      class="box bg-surface border-b border-solid border-border"
      classList={{
        safeTop: props.safeAreaTop !== false,
      }}
      {...dataAttrs({ component: 'TopBar', ...props.dataSet })}
    >
      <div
        class="box flex-row items-center gap-2 px-3 w-full"
        style={{
          height: `${contentHeight()}px`,
          'min-height': `${contentHeight()}px`,
        }}
      >
        <Show when={useAbsoluteCenter()} fallback={<FlexLayout {...props} />}>
          <AbsoluteCenterLayout {...props} />
        </Show>
      </div>
    </header>
  );
}
