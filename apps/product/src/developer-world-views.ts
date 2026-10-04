import { applyConsoleNavPatch, parseConsoleNav } from './console-nav';
import { ensureActor, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { openSettings } from '@libs/harness/shell-actions';
import { harnessConsoleLayoutFromBreakpoint } from '@pkgs/harness-console-client/layout';
import { resolveProductHarnessInstanceId } from '@pkgs/harness-console-client/product-harness-kind-pane';
import { selectUnifiedNode } from '@pkgs/harness-console-client/select-unified-node';
import { tools } from './developer-tools-state';
export const provideWorldDevices = scenarioAction({
  name: 'provideWorldDevices',
  act: async (s, two: boolean) => {
    await ensureActor(s, 'alice');
    if (two) await ensureActor(s, 'bob');
    const state = tools(s);
    state.consoleNav = parseConsoleNav('');
    state.consoleColumns = false;
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
    const state = tools(s);
    if (address) {
      state.consoleNav = parseConsoleNav(`?instance=${id}`);
      return;
    }
    selectUnifiedNode(
      {
        chrome: {
          ...state.consoleNav.harness,
          onKindChange: (kind) => {
            state.consoleNav = applyConsoleNavPatch(state.consoleNav, { kind });
          },
          onInstanceChange: (instance) => {
            state.consoleNav = applyConsoleNavPatch(state.consoleNav, {
              instance,
            });
          },
          onPanePatch: (id, patch) => {
            state.consoleNav = applyConsoleNavPatch(state.consoleNav, {
              harness: { pane: { id, patch } },
            });
          },
        },
        onFocusedClientIdChange: () => {
          /* Selection is read from the chrome instance in this host. */
        },
      },
      { clients: [...s.actors.values()], servers: [], loadBalancerId: 'lb' },
      id
    );
  },
});
export const arrangeWorldDevices = scenarioAction({
  name: 'arrangeWorldDevices',
  act: (s, several: boolean) => {
    tools(s).consoleColumns = harnessConsoleLayoutFromBreakpoint(
      'desktop',
      several ? 'columns' : 'tabs'
    ).multiClientColumns;
  },
});
export const shownWorldDevices = (s: ProductHarness) => {
  const state = tools(s);
  const actors = [...s.actors.values()];
  const chosen = resolveProductHarnessInstanceId(
    state.consoleNav.harness.instance,
    actors
  );
  return state.consoleColumns
    ? actors.map((actor) => actor.id)
    : chosen === null
      ? []
      : [chosen];
};
export async function devicePlaceKept(s: ProductHarness, actor: string) {
  const device = s.actors.get(actor);
  if (device === undefined) throw new Error('Device missing');
  return {
    current: await device.currentPath(),
    saved: tools(s).beforeApps.get(actor) ?? '/',
  };
}
