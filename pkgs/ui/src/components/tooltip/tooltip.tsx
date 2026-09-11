/** @jsxImportSource solid-js */
/**
 * `Tooltip` -- lightweight label popup for icon affordances.
 *
 * Shows on pointer hover when {@link useHoverCapable} is true and on keyboard
 * focus of the wrapped control (any device). The bubble stays mounted while
 * hidden so `aria-describedby` on the control always resolves. When shown, a
 * horizontal shift keeps the centered bubble inside the overlay host (or
 * window fallback). Controls inside read {@link useTooltipTrigger} for
 * `show` / `hide` / `id`.
 */

import {
  createContext,
  createEffect,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { useHoverCapable } from '../../theme';
import { useOverlayPortalHostFrame } from '../overlay-portal';
import { measureHostFrame } from '../portal-host-frame';
import styles from './tooltip.module.css';
import {
  claimActiveTooltip,
  releaseActiveTooltip,
} from './tooltip-coordinator';
import { computeTooltipShiftX } from './tooltip-position';

export type TooltipPlacement = 'top' | 'bottom';

export const TOOLTIP_MAX_WIDTH = 240;

export type TooltipProps = {
  label: JSX.Element;
  children: JSX.Element;
  placement?: TooltipPlacement | undefined;
  /**
   * When true, keyboard `:focus-visible` also shows the bubble. Defaults to
   * true for standalone tooltips; IconButton hover-mode passes false.
   */
  enableFocus?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

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

function useTooltipEdgeShift(
  visible: () => boolean,
  anchor: () => HTMLElement | undefined,
  bubble: () => HTMLElement | undefined
): () => number {
  const hostFrame = useOverlayPortalHostFrame();
  const [shiftX, setShiftX] = createSignal(0);

  createEffect(() => {
    if (!visible()) {
      setShiftX(0);
      return;
    }
    const anchorEl = anchor();
    const bubbleEl = bubble();
    const frame = hostFrame();
    if (anchorEl === undefined || bubbleEl === undefined || frame.width <= 0) {
      setShiftX(0);
      return;
    }
    const anchorRect = measureHostFrame(anchorEl);
    setShiftX(
      computeTooltipShiftX({
        anchorX: anchorRect.x - frame.x,
        anchorWidth: anchorRect.width,
        bubbleWidth: bubbleEl.offsetWidth,
        viewportWidth: frame.width,
      })
    );
  });

  return shiftX;
}

function TooltipAnchor(props: {
  controller: TooltipController;
  enableFocus: boolean | undefined;
  placement: () => TooltipPlacement;
  label: JSX.Element;
  dataSet: ComponentDataSet | undefined;
  children: JSX.Element;
}): JSX.Element {
  const hoverCapable = useHoverCapable();
  const [anchorEl, setAnchorEl] = createSignal<HTMLElement>();
  const [bubbleEl, setBubbleEl] = createSignal<HTMLElement>();
  const shiftX = useTooltipEdgeShift(
    props.controller.visible,
    anchorEl,
    bubbleEl
  );

  return (
    <div
      class="box"
      classList={{ [styles['anchor'] ?? '']: true }}
      role="presentation"
      ref={setAnchorEl}
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
        if (event.key === 'Escape') props.controller.hide();
      }}
    >
      {props.children}
      <div
        class="box bg-surface-elevated rounded-[6px] px-2 py-1 w-max"
        classList={{
          [styles['bubble'] ?? '']: true,
          [styles['top'] ?? '']: props.placement() === 'top',
          [styles['bottom'] ?? '']: props.placement() !== 'top',
          [styles['open'] ?? '']: props.controller.visible(),
        }}
        {...dataAttrs({ component: 'Tooltip', ...props.dataSet })}
        style={{
          'max-width': `${TOOLTIP_MAX_WIDTH}px`,
          '--tooltip-shift-x': `${shiftX()}px`,
        }}
        id={props.controller.id}
        role="tooltip"
        aria-hidden={props.controller.visible() ? undefined : true}
        ref={setBubbleEl}
      >
        <p class="text textCaption line-clamp-2 text-text text-center">
          {props.label}
        </p>
      </div>
    </div>
  );
}

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
    <TooltipContext.Provider value={controller}>
      <TooltipAnchor
        controller={controller}
        enableFocus={props.enableFocus}
        placement={placement}
        label={props.label}
        dataSet={props.dataSet}
      >
        {props.children}
      </TooltipAnchor>
    </TooltipContext.Provider>
  );
}
