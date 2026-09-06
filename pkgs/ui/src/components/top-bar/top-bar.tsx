/** @jsxImportSource solid-js */
/**
 * `TopBar` -- header row with leading / center / trailing slots.
 *
 * `centerAlign="center"` overlays the center slot across the full width so a
 * title stays visually centered regardless of side-slot widths; pass
 * `centerPosition="flex"` to keep it in flow instead.
 */

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import {
  getTopBarContentHeight,
  type SxProps,
  TOP_BAR_CONTENT_HEIGHT_MOBILE,
  useThemeLayout,
} from '../../theme';
import { Box } from '../box';
import styles from '../hosts.module.css';

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

const ALIGN_MAP: Record<
  TopBarCenterAlign,
  'flex-start' | 'center' | 'flex-end'
> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
};

// Side slots / overlay are pointer-transparent via the `.boxNone` class (its
// `> *` rule re-enables children) rather than inline `pointer-events:none`,
// which children would inherit.
const SIDE_SLOT_SX: SxProps = {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2,
  minWidth: 0,
  zIndex: 3,
};

type SlotsProps = Pick<
  TopBarProps,
  'leading' | 'center' | 'trailing' | 'centerAlign' | 'centerPosition'
>;

function FlexLayout(props: SlotsProps): JSX.Element {
  return (
    <>
      <Show when={props.leading !== undefined}>
        <Box
          sx={{
            flexShrink: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {props.leading}
        </Box>
      </Show>
      <Show when={props.center !== undefined && props.center !== null}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: ALIGN_MAP[props.centerAlign ?? 'start'],
          }}
        >
          {props.center}
        </Box>
      </Show>
      <Show when={props.trailing !== undefined && props.trailing !== null}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            alignSelf: 'stretch',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 2,
          }}
        >
          {props.trailing}
        </Box>
      </Show>
    </>
  );
}

function AbsoluteCenterLayout(props: SlotsProps): JSX.Element {
  return (
    <Box
      sx={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Box
        class={styles['boxNone']}
        sx={{ ...SIDE_SLOT_SX, justifyContent: 'flex-start' }}
      >
        {props.leading}
      </Box>
      <Box
        class={styles['boxNone']}
        sx={{ ...SIDE_SLOT_SX, justifyContent: 'flex-end' }}
      >
        {props.trailing}
      </Box>
      <Box
        class={styles['boxNone']}
        sx={{
          position: 'absolute',
          inset: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>{props.center}</Box>
      </Box>
    </Box>
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
    <Box
      as="header"
      dataSet={{ component: 'TopBar', ...props.dataSet }}
      class={(props.safeAreaTop ?? true) ? styles['safeTop'] : undefined}
      sx={{
        background: 'surface',
        borderBottomWidth: 1,
        borderStyle: 'solid',
        borderColor: 'border',
      }}
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          px: 3,
          height: contentHeight(),
          minHeight: contentHeight(),
          width: '100%',
        }}
      >
        <Show when={useAbsoluteCenter()} fallback={<FlexLayout {...props} />}>
          <AbsoluteCenterLayout {...props} />
        </Show>
      </Box>
    </Box>
  );
}
