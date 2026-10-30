/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  claimActiveTooltip,
  releaseActiveTooltip,
} from '@pkgs/ui-root-shared-ts/tooltip-coordinator';
import {
  createContext,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  Show,
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

function TooltipBubble(props: {
  controller: TooltipController;
  placement: () => TooltipPlacement;
  label: JSX.Element;
  dataSet: ComponentDataSet | undefined;
  floating: boolean | undefined;
}) {
  return (
    <div
      class="box bg-surface-overlay border border-border shadow-float rounded-sm px-2 py-1 w-max max-w-60"
      classList={{
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
      }}
      {...dataAttrs({ component: 'Tooltip', ...props.dataSet })}
      id={props.controller.id}
      role="tooltip"
      aria-hidden={props.controller.visible() ? undefined : true}
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
 * static via `placement` unless `floating` portals it outside clipping hosts
 * and positions it within the viewport.
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
    <TooltipContext.Provider value={controller}>
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
    </TooltipContext.Provider>
  );
}
