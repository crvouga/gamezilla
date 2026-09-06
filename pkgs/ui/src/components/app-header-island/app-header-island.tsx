/** @jsxImportSource solid-js */
/**
 * `AppHeaderIsland` -- wide-only top chrome: logo | pill tabs | trailing.
 * Mounted via `AppFrame` `header`; not used on compact layouts. The trailing
 * slot falls back to the `AppFrameChromeProvider` global chrome (avatar menu).
 *
 * @example
 * ```tsx
 * <AppFrame header={<AppHeaderIsland leading={<AppLogo />} items={tabs} />}>
 *   …
 * </AppFrame>
 * ```
 */

import { For, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  getTopBarContentHeight,
  ISLAND_RADIUS,
  useThemeLayout,
} from '../../theme';
import { useAppFrameGlobalTrailing } from '../app-frame';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { Text } from '../text';
import type {
  AppHeaderIslandItem,
  AppHeaderIslandProps,
} from './app-header-island-types';

/** Pills keep a legal pointer target even though the caption is compact. */
const PILL_MIN_HEIGHT = 44;
const PILL_ICON_SIZE = 18;

function HeaderPill(props: { item: AppHeaderIslandItem }): JSX.Element {
  const color = (): 'text' | 'textSecondary' =>
    props.item.active ? 'text' : 'textSecondary';
  return (
    <Clickable
      role="tab"
      aria-selected={props.item.active}
      aria-label={props.item.label}
      onClick={() => props.item.onClick()}
      dataSet={{ component: 'AppHeaderIslandTab', ...props.item.dataSet }}
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1.5,
        px: 3,
        minHeight: PILL_MIN_HEIGHT,
        borderRadius: 'full',
        backgroundColor: props.item.active ? 'surface' : 'transparent',
      }}
    >
      <Dynamic
        component={props.item.icon}
        size={PILL_ICON_SIZE}
        color={color()}
      />
      <Text
        variant="label"
        sx={{ color: color(), fontWeight: props.item.active ? '600' : '500' }}
        label={props.item.label}
      />
    </Clickable>
  );
}

function HeaderPillGroup(props: {
  items: readonly AppHeaderIslandItem[];
}): JSX.Element {
  return (
    <Box
      role="tablist"
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: 'full',
        backgroundColor: 'surfaceMuted',
      }}
    >
      <For each={props.items}>{(item) => <HeaderPill item={item} />}</For>
    </Box>
  );
}

export function AppHeaderIsland(props: AppHeaderIslandProps): JSX.Element {
  const layout = useThemeLayout();
  const globalTrailing = useAppFrameGlobalTrailing();
  const contentHeight = (): number =>
    getTopBarContentHeight(layout.breakpoint());
  const trailing = (): JSX.Element => props.trailing ?? globalTrailing();
  return (
    <Box
      as="header"
      dataSet={{ component: 'AppHeaderIsland', ...props.dataSet }}
      sx={{
        backgroundColor: 'surfaceElevated',
        borderRadius: ISLAND_RADIUS,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'border',
        elevation: 1,
        overflow: 'hidden',
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
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          {props.leading}
        </Box>
        <Show when={(props.items?.length ?? 0) > 0}>
          <Box sx={{ flexShrink: 0 }}>
            <HeaderPillGroup items={props.items ?? []} />
          </Box>
        </Show>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          {trailing()}
        </Box>
      </Box>
    </Box>
  );
}
