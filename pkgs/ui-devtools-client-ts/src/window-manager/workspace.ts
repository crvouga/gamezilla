import {
  type WindowEdge,
  type WindowLayout,
  windowGroups,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import { windowDropCommand } from '@pkgs/ui-devtools-shared-ts/window-layout-geometry';
import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/solid/primitive';
import type { WindowManagerApi } from '../window-manager-context';

type WorkspaceOptions = {
  readonly manager: WindowManagerApi;
  readonly compact: boolean;
  readonly layout: WindowLayout;
};

function visibleTabs(manager: WindowManagerApi) {
  const layout = manager.layout();
  return windowGroups(layout)
    .filter(
      (group) => layout.maximized === null || layout.maximized === group.id
    )
    .flatMap((group) =>
      group.tabs.map((id) => ({
        value: id,
        label: manager.panel(id)?.title ?? id,
        group,
      }))
    );
}

type WorkspaceTab = ReturnType<typeof visibleTabs>[number];

function resolveTab(
  tabs: readonly WorkspaceTab[],
  name: unknown
): WorkspaceTab {
  const byId = tabs.find((tab) => tab.value === name);
  if (byId) return byId;
  const matches = tabs.filter((tab) => tab.label === name);
  if (matches.length === 1 && matches[0]) return matches[0];
  throw new Error('Choose a visible tab by its unique title or panel ID.');
}

function windowEdge(edge: unknown): WindowEdge {
  if (
    edge !== 'left' &&
    edge !== 'right' &&
    edge !== 'top' &&
    edge !== 'bottom'
  )
    throw new Error(
      'Choose the left, right, top, or bottom edge of the destination window.'
    );
  return edge;
}

function move(
  options: WorkspaceOptions,
  source: unknown,
  destination: unknown,
  position: WindowEdge | 'before' | 'after'
) {
  if (options.compact)
    throw new Error('Arranging windows requires the expanded workspace.');
  const tabs = visibleTabs(options.manager);
  const panel = resolveTab(tabs, source).value;
  const target = resolveTab(tabs, destination);
  const window = target.group.id;
  if (position === 'before' || position === 'after') {
    if (panel === target.value) return;
    const index = target.group.tabs
      .filter((id) => id !== panel)
      .indexOf(target.value);
    options.manager.dispatch(
      windowDropCommand(
        panel,
        { window, zone: 'tabs' },
        index + (position === 'after' ? 1 : 0)
      ),
      { focus: true }
    );
    return;
  }
  options.manager.dispatch(
    windowDropCommand(panel, { window, zone: position }),
    { focus: true }
  );
}

function workspaceState(options: WorkspaceOptions) {
  return { compact: options.compact, layout: options.layout };
}

const workspace = definePrimitive({
  name: 'window-workspace',
  options: { manager: 'value', compact: 'boolean', layout: 'value' },
  controlled: ['layout'],
  state: workspaceState,
  sync: workspaceState,
  api: (context) => ({
    items: () =>
      visibleTabs(context.options().manager).map(({ value, label }) => ({
        value,
        label,
      })),
    dockPanel(panel: unknown, destinationPanel: unknown, edge: unknown) {
      move(context.options(), panel, destinationPanel, windowEdge(edge));
    },
    placeTabBefore(panel: unknown, destinationPanel: unknown) {
      move(context.options(), panel, destinationPanel, 'before');
    },
    placeTabAfter(panel: unknown, destinationPanel: unknown) {
      move(context.options(), panel, destinationPanel, 'after');
    },
  }),
  slots: (slot) => ({ root: slot({}) }),
  agent: {
    actions: ['dockPanel', 'placeTabBefore', 'placeTabAfter'],
    items: (api) => api.items(),
    shown: (state) => !state.compact,
  },
});

export const { Root: WindowWorkspace } = createParts(workspace, {
  root: 'div',
});
