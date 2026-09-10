/** @jsxImportSource solid-js */
/**
 * `Tooltip` -- lightweight label popup for icon affordances.
 *
 * Shows on pointer hover when {@link useHoverCapable} is true and on keyboard
 * focus of the wrapped control (any device). The bubble is positioned with
 * CSS relative to the anchor wrapper (no measurement) and stays mounted while
 * hidden so `aria-describedby` on the control always resolves. Controls
 * inside read {@link useTooltipTrigger} for `show` / `hide` / `id`.
 */

import {
  createContext,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { useHoverCapable } from '../../theme';
import styles from './tooltip.module.css';
import {
  claimActiveTooltip,
  releaseActiveTooltip,
} from './tooltip-coordinator';

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

export function Tooltip(props: TooltipProps): JSX.Element {
  const hoverCapable = useHoverCapable();
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
      <div
        class="box"
        classList={{ [styles['anchor'] ?? '']: true }}
        role="presentation"
        onMouseEnter={() => {
          if (hoverCapable()) show();
        }}
        onMouseLeave={() => {
          if (hoverCapable()) hide();
        }}
        onFocusIn={(event) => {
          if (props.enableFocus === false) return;
          // Only keyboard :focus-visible — programmatic focus (modal open)
          // must not pop the tooltip.
          const target = event.target;
          if (
            target instanceof HTMLElement &&
            target.matches(':focus-visible')
          ) {
            show();
          }
        }}
        onFocusOut={() => {
          if (props.enableFocus === false) return;
          hide();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') hide();
        }}
      >
        {props.children}
        <div
          class="box bg-surface-elevated rounded-[6px] px-2 py-1 w-max"
          classList={{
            [styles['bubble'] ?? '']: true,
            [styles['top'] ?? '']: placement() === 'top',
            [styles['bottom'] ?? '']: placement() !== 'top',
            [styles['open'] ?? '']: visible(),
          }}
          {...dataAttrs({ component: 'Tooltip', ...props.dataSet })}
          style={{ 'max-width': `${TOOLTIP_MAX_WIDTH}px` }}
          id={id}
          role="tooltip"
          aria-hidden={visible() ? undefined : true}
        >
          <p class="text textCaption line-clamp-2 text-text text-center">
            {props.label}
          </p>
        </div>
      </div>
    </TooltipContext.Provider>
  );
}
