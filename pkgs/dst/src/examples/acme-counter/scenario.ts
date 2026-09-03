import fc from 'fast-check';
import { gen } from '../../fast-check';
import { defineSystem, virtualHost, wallHost } from '../../index';
import type { Page } from './page';

export type CounterPorts = {
  readonly openPage: () => Promise<Page>;
};

export type CounterSurface = {
  readonly page: Page;
};

/** Toy HTML counter — surface is a DOM Page (happy-dom or Bun.WebView). */
export const counter = defineSystem({
  name: 'acme-counter',
  async generate(session) {
    const ports = session.ports as typeof session.ports & CounterPorts;
    const page = await ports.openPage();
    session.onDispose(() => page.dispose());
    return { page } satisfies CounterSurface;
  },
});

const { defineAction, defineProperty } = counter;

export async function route(s: CounterSurface): Promise<string> {
  return (await s.page.routeAttr()) ?? '';
}

export async function count(s: CounterSurface): Promise<number> {
  return Number(await s.page.text('#count'));
}

export async function step(s: CounterSurface): Promise<number> {
  return Number(await s.page.text('#step'));
}

const SCREENS = new Set(['home', 'settings', 'confirm-reset']);
const STEP_CHOICES = [1, 5, 10] as const;

export const increment = defineAction({
  name: 'increment',
  enabled: async (s) => (await route(s)) === 'home',
  weight: async (s) => ((await count(s)) < 50 ? 6 : 2),
  act: (s) => s.page.click('#increment'),
});

export const decrement = defineAction({
  name: 'decrement',
  enabled: async (s) => (await route(s)) === 'home' && (await count(s)) > 0,
  weight: async (s) => Math.min(await count(s), 4),
  act: (s) => s.page.click('#decrement'),
});

export const openSettings = defineAction({
  name: 'openSettings',
  enabled: async (s) => (await route(s)) === 'home',
  act: (s) => s.page.click('#to-settings'),
});

export const setStep = defineAction({
  name: 'setStep',
  enabled: async (s) => (await route(s)) === 'settings',
  weight: 2,
  args: async (s) => {
    const current = await step(s);
    const rest = STEP_CHOICES.filter((n) => n !== current);
    const choices = rest.length > 0 ? rest : STEP_CHOICES;
    return gen(fc.constantFrom(...choices));
  },
  act: (s, n: number) => s.page.click(`#step-${n}`),
});

export const leaveSettings = defineAction({
  name: 'leaveSettings',
  enabled: async (s) => (await route(s)) === 'settings',
  act: (s) => s.page.click('#back'),
});

export const openReset = defineAction({
  name: 'openReset',
  enabled: async (s) => (await route(s)) === 'home' && (await count(s)) > 0,
  weight: async (s) => ((await count(s)) > 100 ? 3 : 1),
  act: (s) => s.page.click('#reset'),
});

export const confirmReset = defineAction({
  name: 'confirmReset',
  enabled: async (s) => (await route(s)) === 'confirm-reset',
  act: (s) => s.page.click('#confirm'),
});

export const reset = defineAction({
  name: 'reset',
  enabled: async (s) => (await route(s)) === 'home' && (await count(s)) > 0,
  weight: async (s) => ((await count(s)) > 100 ? 3 : 1),
  act: async (s) => {
    await s.page.click('#reset');
    await s.page.click('#confirm');
  },
});

export const COUNTER_ACTIONS = [
  increment,
  decrement,
  openSettings,
  setStep,
  leaveSettings,
  openReset,
  confirmReset,
  reset,
] as const;

export const knownScreen = defineProperty({
  name: 'knownScreen',
  check: async (s) => {
    const r = await route(s);
    if (!SCREENS.has(r)) throw new Error(`unknown screen ${r}`);
  },
});

export const nonNegative = defineProperty({
  name: 'nonNegative',
  check: async (s) => {
    if ((await count(s)) < 0) {
      throw new Error('count went negative');
    }
  },
});

export const COUNTER_PROPERTIES = [knownScreen, nonNegative];

/** Lazy-import so Bun.WebView tests never load happy-dom (spawn breaks after it). */
export function happyDomHost() {
  return virtualHost().with(async () => {
    const { openHappyDomPage } = await import('./happy-dom-page');
    return { openPage: () => openHappyDomPage() };
  });
}

export function webViewHost() {
  return wallHost({ network: 'none' }).with(async () => {
    const { openWebViewPage } = await import('./webview-page');
    return { openPage: () => openWebViewPage() };
  });
}
