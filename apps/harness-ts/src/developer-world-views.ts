import { ensureActor, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { openSettings } from '@libs/harness-ts/shell-actions';
import {
  arrangeHarnessLayout,
  type HarnessArrangement,
  harnessPanelId,
  harnessPanels,
  resolveHarnessLayout,
  shownHarnessClients,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import {
  applyWindowLayoutCommand,
  type WindowLayout,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import { serializeWindowLayout } from '@pkgs/ui-devtools-shared-ts/window-layout-codec';
import {
  applyConsoleNavPatch,
  buildConsoleSearch,
  DEFAULT_CONSOLE_NAV,
  parseConsoleNav,
} from './console-nav';
import { tools } from './developer-tools-state';

/** The console's panels for a world of these devices. */
function worldPanels(devices: readonly string[]): readonly string[] {
  return harnessPanels({ clients: devices, servers: [], rooms: [] }).map(
    (panel) => panel.id
  );
}
function worldLayout(s: ProductHarness): WindowLayout {
  return resolveHarnessLayout(
    tools(s).consoleNav.layout,
    worldPanels([...s.actors.keys()])
  );
}
function showWorld(s: ProductHarness, layout: WindowLayout): void {
  const state = tools(s);
  state.consoleNav = applyConsoleNavPatch(state.consoleNav, {
    layout: serializeWindowLayout(layout),
  });
}
function arrangeWorld(s: ProductHarness, arrangement: HarnessArrangement) {
  showWorld(
    s,
    arrangeHarnessLayout(
      worldPanels([...s.actors.keys()]),
      arrangement,
      worldLayout(s)
    )
  );
}
function chosen(layout: WindowLayout, device: string): WindowLayout {
  return applyWindowLayoutCommand(layout, {
    type: 'select',
    panel: harnessPanelId('client', device),
  });
}
export const provideWorldDevices = scenarioAction({
  name: 'provideWorldDevices',
  act: async (s, two: boolean) => {
    await ensureActor(s, 'alice');
    if (two) await ensureActor(s, 'bob');
    tools(s).consoleNav = DEFAULT_CONSOLE_NAV;
    arrangeWorld(s, 'tabs');
  },
});
export const giveDevicesDifferentPlaces = scenarioAction({
  name: 'giveDevicesDifferentPlaces',
  act: async (s) => {
    await Promise.resolve(openSettings.act(s, 'bob'));
    const actor = s.actors.get('bob');
    if (actor === undefined) throw new Error('Bob missing');
    tools(s).beforeApps.set('bob', await actor.currentPath());
  },
});
export const chooseWorldDevice = scenarioAction({
  name: 'chooseWorldDevice',
  act: (s, id: string, address = false) => {
    if (!address) {
      showWorld(s, chosen(worldLayout(s), id));
      return;
    }
    // The address of a world that has the device, with the device on show.
    const devices = [...new Set([...s.actors.keys(), id])];
    const layout = chosen(
      arrangeHarnessLayout(worldPanels(devices), 'tabs'),
      id
    );
    tools(s).consoleNav = parseConsoleNav(
      buildConsoleSearch({
        ...DEFAULT_CONSOLE_NAV,
        layout: serializeWindowLayout(layout),
      })
    );
  },
});
export const arrangeWorldDevices = scenarioAction({
  name: 'arrangeWorldDevices',
  act: (s, several: boolean) => {
    arrangeWorld(s, several ? 'beside' : 'tabs');
  },
});
export const shownWorldDevices = (s: ProductHarness) =>
  shownHarnessClients(worldLayout(s));
export async function devicePlaceKept(s: ProductHarness, actor: string) {
  const device = s.actors.get(actor);
  if (device === undefined) throw new Error('Device missing');
  return {
    current: await device.currentPath(),
    saved: tools(s).beforeApps.get(actor) ?? '/',
  };
}
