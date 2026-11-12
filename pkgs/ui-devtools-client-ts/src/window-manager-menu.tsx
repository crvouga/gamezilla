/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import {
  WINDOW_EDGES,
  type WindowEdge,
  type WindowGroup,
  windowById,
  windowSplits,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import { windowNeighbor } from '@pkgs/ui-devtools-shared-ts/window-layout-geometry';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  Columns2Icon,
  Maximize2Icon,
  Minimize2Icon,
  PanelBottomIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PanelTopIcon,
  XIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { OverflowMenuAction } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import {
  useWindowManager,
  type WindowManagerApi,
} from './window-manager-context';
import {
  useWindowManagerText,
  type WindowManagerText,
} from './window-manager-text';

const SPLIT_ICON: Readonly<Record<WindowEdge, IconComponent>> = {
  left: PanelLeftIcon,
  right: PanelRightIcon,
  top: PanelTopIcon,
  bottom: PanelBottomIcon,
};

const MOVE_ICON: Readonly<Record<WindowEdge, IconComponent>> = {
  left: ArrowLeftIcon,
  right: ArrowRightIcon,
  top: ArrowUpIcon,
  bottom: ArrowDownIcon,
};

/** Split and move rows: the menu's equivalents of dragging the active tab. */
function arrangeActions(
  api: WindowManagerApi,
  text: WindowManagerText,
  group: WindowGroup
): OverflowMenuAction[] {
  const panel = group.active;
  const splits = WINDOW_EDGES.map(
    (edge): OverflowMenuAction => ({
      id: `split-${edge}`,
      label: text.splitLabel(edge),
      icon: SPLIT_ICON[edge],
      disabled: group.tabs.length === 1,
      onClick: () =>
        api.dispatch(
          { type: 'split', panel, window: group.id, edge },
          { focus: true }
        ),
    })
  );
  const moves = WINDOW_EDGES.flatMap((edge): OverflowMenuAction[] => {
    const neighbor = windowNeighbor(api.layout(), group.id, edge);
    if (neighbor === null) return [];
    return [
      {
        id: `move-${edge}`,
        label: text.moveLabel(edge),
        icon: MOVE_ICON[edge],
        onClick: () =>
          api.dispatch(
            { type: 'move', panel, window: neighbor },
            { focus: true }
          ),
      },
    ];
  });
  const rows = [...splits, ...moves];
  return rows.map((row, index) =>
    index === rows.length - 1 ? { ...row, endsGroup: true } : row
  );
}

/**
 * The rows of a window's menu. They act on the window's visible panel and
 * reach everything a drag does, so the menu is the keyboard and
 * screen-reader path to the same layouts.
 */
export function useWindowMenuActions(
  windowId: () => string
): () => readonly OverflowMenuAction[] {
  const { t } = useLingui();
  const api = useWindowManager();
  const text = useWindowManagerText();
  const sizing = (group: WindowGroup): OverflowMenuAction[] => {
    const layout = api.layout();
    const maximized = layout.maximized === group.id;
    const many = windowSplits(layout).length > 0;
    return [
      ...(many
        ? [
            {
              id: 'maximize',
              label: maximized ? t`Restore windows` : t`Maximize window`,
              icon: maximized ? Minimize2Icon : Maximize2Icon,
              onClick: () =>
                api.dispatch(
                  maximized
                    ? { type: 'restore' }
                    : { type: 'maximize', window: group.id }
                ),
            },
            {
              id: 'equalize',
              label: t`Even out window sizes`,
              icon: Columns2Icon,
              onClick: () => api.dispatch({ type: 'equalize' }),
            },
          ]
        : []),
    ];
  };
  const closing = (group: WindowGroup): OverflowMenuAction[] => {
    const panel = api.panel(group.active);
    if (panel === undefined || panel.closable === false) return [];
    const title = panel.title;
    return [
      {
        id: 'close',
        label: t`Close ${title}`,
        icon: XIcon,
        onClick: () =>
          api.dispatch({ type: 'close', panel: panel.id }, { focus: true }),
      },
    ];
  };
  return () => {
    const group = windowById(api.layout(), windowId());
    if (group === null) return api.menuActions();
    const own = api.compact()
      ? closing(group)
      : [
          ...arrangeActions(api, text, group),
          ...sizing(group),
          ...closing(group),
        ];
    const last = own.length - 1;
    const extra = api.menuActions();
    return [
      ...own.map((row, index) => ({
        ...row,
        dataSet: { 'window-action': row.id },
        ...(index === last && extra.length > 0 ? { endsGroup: true } : {}),
      })),
      ...extra,
    ];
  };
}
