/** @jsxImportSource solid-js */
/**
 * `AvatarGroup` -- horizontally stacked avatars with overlap (e.g. presence strip).
 *
 * Children are resolved once and sliced by `maxVisible`; the remainder shows
 * as a `+N` pill (or `renderOverflow`). With `onClick` the whole strip is one
 * `Clickable`.
 */

import {
  createMemo,
  For,
  type JSX,
  children as resolveChildren,
  Show,
} from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import type { SxProps } from '../../theme';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { Text } from '../text';

export type AvatarGroupProps = {
  /** Avatar diameter in px; used for slot size and default overlap. */
  size?: number | undefined;
  /** Horizontal overlap in px; defaults to ~40% of `size`. */
  overlap?: number | undefined;
  /** Max avatars before showing an overflow pill. Omit for no limit. */
  maxVisible?: number | undefined;
  /** Border between stacked faces. Defaults to `2`. */
  ringBorderWidth?: number | undefined;
  /** Theme color token or raw color for the ring. Defaults to `'surface'`. */
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
const DEFAULT_RING_COLOR = 'surface';

type RingMetrics = {
  size: number;
  overlap: number;
  ringBorderWidth: number;
  ringColor: string;
};

function slotSx(metrics: RingMetrics, index: number): SxProps {
  return {
    marginLeft: index === 0 ? 0 : -metrics.overlap,
    zIndex: index + 1,
    width: metrics.size,
    height: metrics.size,
    borderRadius: 'full',
    borderWidth: metrics.ringBorderWidth,
    borderColor: metrics.ringColor,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function DefaultOverflowPill(props: {
  count: number;
  metrics: RingMetrics;
}): JSX.Element {
  return (
    <Box
      sx={{
        width: props.metrics.size,
        height: props.metrics.size,
        borderRadius: 'full',
        borderWidth: props.metrics.ringBorderWidth,
        borderColor: props.metrics.ringColor,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'outline',
      }}
    >
      <Text
        variant="caption"
        label={`+${String(props.count)}`}
        sx={{ color: 'text' }}
      />
    </Box>
  );
}

export function AvatarGroup(props: AvatarGroupProps): JSX.Element {
  const resolved = resolveChildren(() => props.children);
  const items = createMemo(() =>
    resolved
      .toArray()
      .filter((node) => node !== null && node !== undefined && node !== false)
  );
  const metrics = createMemo((): RingMetrics => {
    const size = props.size ?? DEFAULT_SIZE;
    return {
      size,
      overlap: props.overlap ?? Math.round(size * 0.4),
      ringBorderWidth: props.ringBorderWidth ?? DEFAULT_RING_WIDTH,
      ringColor: props.ringColor ?? DEFAULT_RING_COLOR,
    };
  });
  const visible = createMemo(() =>
    items().slice(0, props.maxVisible ?? items().length)
  );
  const hiddenCount = () => Math.max(0, items().length - visible().length);

  const strip = (): JSX.Element => (
    <Box
      dataSet={
        props.onClick === undefined
          ? { component: 'AvatarGroup', ...props.dataSet }
          : undefined
      }
      sx={{ flexDirection: 'row', alignItems: 'center' }}
    >
      <For each={visible()}>
        {(child, index) => <Box sx={slotSx(metrics(), index())}>{child}</Box>}
      </For>
      <Show when={hiddenCount() > 0}>
        <Box
          sx={{
            marginLeft: visible().length === 0 ? 0 : -metrics().overlap,
            zIndex: visible().length + 2,
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
        </Box>
      </Show>
    </Box>
  );

  return (
    <Show when={props.onClick} fallback={strip()}>
      {(onClick) => (
        <Clickable
          onClick={() => onClick()()}
          aria-label={props['aria-label']}
          sx={{ alignSelf: 'flex-start', borderRadius: 'full' }}
          dataSet={{ component: 'AvatarGroup', ...props.dataSet }}
        >
          {strip()}
        </Clickable>
      )}
    </Show>
  );
}
