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
  async create(session) {
    const ports = session.ports as typeof session.ports & CounterPorts;
    const page = await ports.openPage();
    session.onDispose(() => page.dispose());
    return { page } satisfies CounterSurface;
  },
});

counter.host({
  default: true,
  name: 'happy-dom',
  create: () => happyDomHost(),
});
counter.host({
  name: 'webview',
  create: () => webViewHost(),
});

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

export const increment = counter.action({
  name: 'increment',
  enabled: async (s) => (await route(s)) === 'home',
  weight: async (s) => ((await count(s)) < 50 ? 6 : 2),
  act: (s) => s.page.click('#increment'),
});

export const decrement = counter.action({
  name: 'decrement',
  enabled: async (s) => (await route(s)) === 'home' && (await count(s)) > 0,
  weight: async (s) => Math.min(await count(s), 4),
  act: (s) => s.page.click('#decrement'),
});

export const openSettings = counter.action({
  name: 'openSettings',
  enabled: async (s) => (await route(s)) === 'home',
  act: (s) => s.page.click('#to-settings'),
});

export const setStep = counter.action({
  name: 'setStep',
  enabled: async (s) => (await route(s)) === 'settings',
  weight: 2,
  args: [5] as const,
  draw: async (s) => {
    const current = await step(s);
    const rest = STEP_CHOICES.filter((n) => n !== current);
    const choices = rest.length > 0 ? rest : STEP_CHOICES;
    return gen(fc.constantFrom(...choices));
  },
  act: (s, n: number) => s.page.click(`#step-${n}`),
});

export const leaveSettings = counter.action({
  name: 'leaveSettings',
  enabled: async (s) => (await route(s)) === 'settings',
  act: (s) => s.page.click('#back'),
});

export const openReset = counter.action({
  name: 'openReset',
  enabled: async (s) => (await route(s)) === 'home' && (await count(s)) > 0,
  weight: async (s) => ((await count(s)) > 100 ? 3 : 1),
  act: (s) => s.page.click('#reset'),
});

export const confirmReset = counter.action({
  name: 'confirmReset',
  enabled: async (s) => (await route(s)) === 'confirm-reset',
  act: (s) => s.page.click('#confirm'),
});

export const reset = counter.action({
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

export const knownScreen = counter.property({
  name: 'knownScreen',
  check: async (s) => {
    const r = await route(s);
    if (!SCREENS.has(r)) throw new Error(`unknown screen ${r}`);
  },
});

export const nonNegative = counter.property({
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
