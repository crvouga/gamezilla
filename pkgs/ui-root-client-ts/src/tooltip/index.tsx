/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  claimActiveTooltip,
  releaseActiveTooltip,
} from '@pkgs/ui-root-shared-ts/tooltip-coordinator';
import type { JSX } from '@solidjs/web';
import {
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  Show,
  untrack,
  useContext,
} from 'solid-js';
import { FloatingTooltip } from '../floating-tooltip/index';
import { useHoverCapable } from '../use-hover-capable';
import styles from './tooltip.module.css';

/** Static CSS placement — no measurement or auto-flip. Bare `top`/`bottom`
 *  center on the trigger; `*-start` / `*-end` pin to that edge. */
export type TooltipPlacement =
  | 'top'
  | 'bottom'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end';

export type TooltipProps = {
  label: JSX.Element;
  children: JSX.Element;
  /** Static placement. Defaults to centered `bottom`. */
  placement?: TooltipPlacement | undefined;
  /** Portal the label beyond clipping containers. */
  floating?: boolean | undefined;
  /**
   * When true, keyboard `:focus-visible` also shows the bubble. Defaults to
   * true for standalone tooltips; IconButton hover-mode passes false.
   */
  enableFocus?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function tooltipSide(placement: TooltipPlacement): 'top' | 'bottom' {
  return placement.startsWith('top') ? 'top' : 'bottom';
}

function tooltipAlign(placement: TooltipPlacement): 'start' | 'center' | 'end' {
  if (placement.endsWith('-start')) return 'start';
  if (placement.endsWith('-end')) return 'end';
  return 'center';
}

export type TooltipController = {
  show: () => void;
  hide: () => void;
  /** DOM id of the bubble, for `aria-describedby` on the trigger. */
  id: string;
  /** Reactive: whether the bubble is currently shown. */
  visible: () => boolean;
};

const TooltipContext = createContext<TooltipController | null>(null);

export function useTooltipTrigger(): TooltipController | null {
  return useContext(TooltipContext);
}

function TooltipAnchor(props: {
  controller: TooltipController;
  enableFocus: boolean | undefined;
  placement: () => TooltipPlacement;
  label: JSX.Element;
  dataSet: ComponentDataSet | undefined;
  children: JSX.Element;
  floating: boolean | undefined;
}): JSX.Element {
  const hoverCapable = useHoverCapable();
  let anchor: HTMLDivElement | undefined;
  const bubble = () => (
    <TooltipBubble
      controller={props.controller}
      placement={props.placement}
      label={props.label}
      dataSet={props.dataSet}
      floating={props.floating}
    />
  );
  return (
    <div
      ref={anchor}
      class={['box', { [styles['anchor'] ?? '']: true }]}
      role="presentation"
      onMouseEnter={() => {
        if (hoverCapable()) props.controller.show();
      }}
      onMouseLeave={() => {
        if (hoverCapable()) props.controller.hide();
      }}
      onFocusIn={(event) => {
        if (props.enableFocus === false) return;
        const target = event.target;
        if (target instanceof HTMLElement && target.matches(':focus-visible')) {
          props.controller.show();
        }
      }}
      onFocusOut={() => {
        if (props.enableFocus === false) return;
        props.controller.hide();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && props.controller.visible()) {
          event.stopPropagation();
          props.controller.hide();
        }
      }}
    >
      {props.children}
      <Show when={props.floating} fallback={bubble()}>
        <FloatingTooltip
          anchor={() => anchor}
          visible={props.controller.visible}
          placement={props.placement}
        >
          {bubble()}
        </FloatingTooltip>
      </Show>
    </div>
  );
}

/** The least room a bubble keeps between itself and the screen's edge. */
const EDGE_MARGIN_PX = 8;

/**
 * How far to slide a bubble sideways so all of it is on screen: right when
 * it runs off the left edge, left when off the right; `0` when it fits. A
 * bubble wider than the screen keeps its start in view.
 */
export function tooltipEdgeShift(
  bubble: { readonly left: number; readonly right: number },
  viewportWidth: number
): number {
  const min = EDGE_MARGIN_PX;
  const max = viewportWidth - EDGE_MARGIN_PX;
  if (bubble.left < min) return min - bubble.left;
  if (bubble.right > max)
    return Math.max(max - bubble.right, min - bubble.left);
  return 0;
}

function TooltipBubble(props: {
  controller: TooltipController;
  placement: () => TooltipPlacement;
  label: JSX.Element;
  dataSet: ComponentDataSet | undefined;
  floating: boolean | undefined;
}) {
  let bubble: HTMLDivElement | undefined;
  const [shift, setShift] = createSignal(0);
  // A static bubble is placed by CSS against its trigger, so beside the
  // screen's edge part of it would fall outside: slide it back in as it
  // opens. A floating one is already placed within the viewport.
  createEffect(
    () => props.controller.visible() && props.floating !== true,
    (opened) => {
      if (!opened) return;
      const view = bubble?.ownerDocument.defaultView;
      if (bubble === undefined || view == null) return;
      const rect = bubble.getBoundingClientRect();
      // Nothing is laid out (no renderer): there is no edge to keep clear of.
      if (rect.width === 0) return;
      // Where CSS alone put it: the last slide is taken back out, and reading
      // it never makes this run again.
      const slid = untrack(shift);
      const placed = { left: rect.left - slid, right: rect.right - slid };
      setShift(tooltipEdgeShift(placed, view.innerWidth));
    }
  );
  return (
    <div
      ref={bubble}
      style={{ translate: shift() === 0 ? undefined : `${shift()}px 0` }}
      class={[
        'box bg-surface-overlay border border-border shadow-float rounded-sm px-2 py-1 w-max max-w-60',
        {
          [styles['bubble'] ?? '']: !props.floating,
          [styles['floating'] ?? '']: props.floating === true,
          [styles['top'] ?? '']:
            !props.floating && tooltipSide(props.placement()) === 'top',
          [styles['bottom'] ?? '']:
            !props.floating && tooltipSide(props.placement()) === 'bottom',
          [styles['start'] ?? '']:
            !props.floating && tooltipAlign(props.placement()) === 'start',
          [styles['center'] ?? '']:
            !props.floating && tooltipAlign(props.placement()) === 'center',
          [styles['end'] ?? '']:
            !props.floating && tooltipAlign(props.placement()) === 'end',
          [styles['open'] ?? '']: props.controller.visible(),
        },
      ]}
      {...dataAttrs({ component: 'Tooltip', ...props.dataSet })}
      id={props.controller.id}
      role="tooltip"
      aria-hidden={props.controller.visible() ? undefined : 'true'}
    >
      <p class="text textFootnote line-clamp-2 text-text text-center">
        {props.label}
      </p>
    </div>
  );
}

/**
 * `Tooltip` -- lightweight label popup for icon affordances.
 *
 * Shows on pointer hover when {@link useHoverCapable} is true and on keyboard
 * focus of the wrapped control (any device). The bubble stays mounted while
 * hidden so `aria-describedby` on the control always resolves. Position is
 * static via `placement`, slid sideways as it opens when it would cross the
 * screen's edge, unless `floating` portals it outside clipping hosts and
 * positions it within the viewport.
 * Controls inside read {@link useTooltipTrigger} for `show` / `hide` / `id`.
 *
 * The bubble floats above content like a menu: the `surface-overlay` fill,
 * one hairline, a 4px radius and `shadow-float`, with a `textFootnote`
 * label in full text color, at most 240px wide and two lines. It fades in
 * over 150ms; reduced motion shows it at once.
 */
export function Tooltip(props: TooltipProps): JSX.Element {
  const id = `ui-tooltip-${createUniqueId()}`;
  const [visible, setVisible] = createSignal(false);

  const hide = (): void => {
    setVisible(false);
    releaseActiveTooltip(hide);
  };
  const show = (): void => {
    claimActiveTooltip(hide);
    setVisible(true);
  };
  onCleanup(() => releaseActiveTooltip(hide));

  const controller: TooltipController = { show, hide, id, visible };
  const placement = (): TooltipPlacement => props.placement ?? 'bottom';

  return (
    <TooltipContext value={controller}>
      <TooltipAnchor
        controller={controller}
        enableFocus={props.enableFocus}
        placement={placement}
        label={props.label}
        dataSet={props.dataSet}
        floating={props.floating}
      >
        {props.children}
      </TooltipAnchor>
    </TooltipContext>
  );
}
