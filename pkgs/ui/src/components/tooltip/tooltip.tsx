/** @jsxImportSource solid-js */
/**
 * `Tooltip` -- lightweight label popup for icon affordances.
 *
 * Shows on pointer hover when {@link useHoverCapable} is true and on keyboard
 * focus of the wrapped control (any device). The bubble stays mounted while
 * hidden so `aria-describedby` on the control always resolves. Position is
 * static via the `placement` prop (`top` | `bottom`); no measurement or
 * enter animation. Controls inside read {@link useTooltipTrigger} for
 * `show` / `hide` / `id`.
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

function TooltipAnchor(props: {
  controller: TooltipController;
  enableFocus: boolean | undefined;
  placement: () => TooltipPlacement;
  label: JSX.Element;
  dataSet: ComponentDataSet | undefined;
  children: JSX.Element;
}): JSX.Element {
  const hoverCapable = useHoverCapable();

  return (
    <div
      class="box"
      classList={{ [styles['anchor'] ?? '']: true }}
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
        }}
        id={props.controller.id}
        role="tooltip"
        aria-hidden={props.controller.visible() ? undefined : true}
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
