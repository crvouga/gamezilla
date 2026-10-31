/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { colorVar } from '@pkgs/ui-root-shared-ts/css-vars';
import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import {
  createMemo,
  For,
  type JSX,
  children as resolveChildren,
  Show,
} from 'solid-js';
import { formatCompactNumber } from '../compact-number';
import { useThemeTokens } from '../theme-context/index';

export type AvatarGroupProps = {
  /** Avatar diameter in px; used for slot size and default overlap. */
  size?: number | undefined;
  /** Horizontal overlap in px; defaults to ~40% of `size`. */
  overlap?: number | undefined;
  /** Max avatars before showing an overflow pill. Omit for no limit. */
  maxVisible?: number | undefined;
  /** Border between stacked faces. Defaults to `2`. */
  ringBorderWidth?: number | undefined;
  /** Theme color token for the ring. Defaults to the canvas, `'background'`. */
  ringColor?: string | undefined;
  /** Custom overflow node; default is `+N` in a matching circle. */
  renderOverflow?: ((hiddenCount: number) => JSX.Element) | undefined;
  children: JSX.Element;
  onClick?: (() => void) | undefined;
  /** Accessible name for the strip when `onClick` is set. */
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const DEFAULT_SIZE = 40;
const DEFAULT_RING_WIDTH = 2;
const DEFAULT_RING_COLOR = 'background';
const SLOT_CLASS =
  'box shrink-0 rounded-full border-solid overflow-hidden items-center justify-center';

type RingMetrics = {
  size: number;
  overlap: number;
  ringBorderWidth: number;
  ringColor: string;
};

function slotStyle(metrics: RingMetrics, index: number): JSX.CSSProperties {
  return {
    'margin-left': index === 0 ? '0' : `-${metrics.overlap}px`,
    'z-index': index + 1,
    width: `${metrics.size}px`,
    height: `${metrics.size}px`,
    'border-width': `${metrics.ringBorderWidth}px`,
    'border-color': metrics.ringColor,
  };
}

function DefaultOverflowPill(props: {
  count: number;
  metrics: RingMetrics;
}): JSX.Element {
  const { i18n } = useLingui();
  return (
    <div
      class={`${SLOT_CLASS} bg-surface-muted`}
      style={{
        'border-color': props.metrics.ringColor,
        width: `${props.metrics.size}px`,
        height: `${props.metrics.size}px`,
        'border-width': `${props.metrics.ringBorderWidth}px`,
      }}
    >
      <p class="text textFootnote textNumeral text-text whitespace-nowrap">{`+${formatCompactNumber(props.count, i18n().locale)}`}</p>
    </div>
  );
}

/**
 * `AvatarGroup` -- horizontally stacked avatars with overlap (e.g. presence strip).
 *
 * Each face sits in a canvas-colored ring so overlapping circles read as
 * cut-outs, the way the big social apps stack faces. Children are resolved
 * once and sliced by `maxVisible`; the remainder shows as a `+N` disc on the
 * muted plate (or `renderOverflow`), compact from 1,000 (`+12.4K`). With `onClick` the whole strip is one
 * button with the hover / press tint and the focus ring.
 */
export function AvatarGroup(props: AvatarGroupProps): JSX.Element {
  const tokens = useThemeTokens();
  const resolved = resolveChildren(() => props.children);
  const items = createMemo(() =>
    resolved
      .toArray()
      .filter((node) => node !== null && node !== undefined && node !== false)
  );
  const metrics = createMemo((): RingMetrics => {
    const size = props.size ?? DEFAULT_SIZE;
    const ringToken = props.ringColor ?? DEFAULT_RING_COLOR;
    return {
      size,
      overlap: props.overlap ?? Math.round(size * 0.4),
      ringBorderWidth: props.ringBorderWidth ?? DEFAULT_RING_WIDTH,
      ringColor:
        resolveColor(ringToken, tokens.colors) ?? colorVar('background'),
    };
  });
  const visible = createMemo(() =>
    items().slice(0, props.maxVisible ?? items().length)
  );
  const hiddenCount = () => Math.max(0, items().length - visible().length);

  const strip = (): JSX.Element => (
    <div
      class="box flex-row items-center"
      {...dataAttrs(
        props.onClick === undefined
          ? { component: 'AvatarGroup', ...props.dataSet }
          : undefined
      )}
    >
      <For each={visible()}>
        {(child, index) => (
          <div class={SLOT_CLASS} style={slotStyle(metrics(), index())}>
            {child}
          </div>
        )}
      </For>
      <Show when={hiddenCount() > 0}>
        <div
          class="box"
          style={{
            'margin-left':
              visible().length === 0 ? '0' : `-${metrics().overlap}px`,
            'z-index': visible().length + 2,
          }}
        >
          <Show
            when={props.renderOverflow}
            fallback={
              <DefaultOverflowPill count={hiddenCount()} metrics={metrics()} />
            }
          >
            {(render) => render()(hiddenCount())}
          </Show>
        </div>
      </Show>
    </div>
  );

  return (
    <Show when={props.onClick} fallback={strip()}>
      {(onClick) => (
        <button
          class="clickable clickableTint self-start rounded-full"
          {...dataAttrs({ component: 'AvatarGroup', ...props.dataSet })}
          type="button"
          onClick={() => onClick()()}
          aria-label={props['aria-label']}
        >
          {strip()}
        </button>
      )}
    </Show>
  );
}
