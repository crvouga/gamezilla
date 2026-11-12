import { ensureActor, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  harnessPanelId,
  harnessPanels,
  resolveHarnessView,
  shownHarnessClient,
} from '@pkgs/harness-console-shared-ts/harness-windows';
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
export const provideWorldDevices = scenarioAction({
  name: 'provideWorldDevices',
  act: async (s, two: boolean) => {
    await ensureActor(s, 'alice');
    if (two) await ensureActor(s, 'bob');
    tools(s).consoleNav = DEFAULT_CONSOLE_NAV;
  },
});
export const chooseWorldDevice = scenarioAction({
  name: 'chooseWorldDevice',
  act: (s, id: string, address = false) => {
    const show = harnessPanelId('client', id);
    const state = tools(s);
    // By address: what a link to that device parses to, whoever is there.
    state.consoleNav = address
      ? parseConsoleNav(buildConsoleSearch({ ...DEFAULT_CONSOLE_NAV, show }))
      : applyConsoleNavPatch(state.consoleNav, { show });
  },
});
/** The devices whose app the team sees: the one on show. */
export const shownWorldDevices = (s: ProductHarness): readonly string[] => {
  const shown = shownHarnessClient(
    resolveHarnessView(
      tools(s).consoleNav.show,
      worldPanels([...s.actors.keys()])
    )
  );
  return shown === null ? [] : [shown];
};
export async function devicePlaceKept(s: ProductHarness, actor: string) {
  const device = s.actors.get(actor);
  if (device === undefined) throw new Error('Device missing');
  return {
    current: await device.currentPath(),
    saved: tools(s).beforeApps.get(actor) ?? '/',
  };
}
