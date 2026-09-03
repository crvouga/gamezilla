import {
  defineSystem,
  draw,
  observe,
  virtualHost,
  wallHost,
} from '../../index';
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
    const prevDispose = session.dispose.bind(session);
    (session as { dispose: () => Promise<void> }).dispose = async () => {
      await page.dispose();
      await prevDispose();
    };
    return { page } satisfies CounterSurface;
  },
});

const { defineObservation, defineAction, defineProperty } = counter;

export const route = defineObservation({
  name: 'route',
  observe: async (s) => (await s.page.routeAttr()) ?? '',
});

export const count = defineObservation({
  name: 'count',
  observe: async (s) => Number(await s.page.text('#count')),
});

export const step = defineObservation({
  name: 'step',
  observe: async (s) => Number(await s.page.text('#step')),
});

const SCREENS = new Set(['home', 'settings', 'confirm-reset']);

export const increment = defineAction({
  name: 'increment',
  *generate() {
    const o = yield* observe({ route, count });
    if (o.route !== 'home') return;
    yield {
      weight: o.count < 50 ? 6 : 2,
      act: (s) => s.page.click('#increment'),
    };
  },
});

export const decrement = defineAction({
  name: 'decrement',
  *generate() {
    const o = yield* observe({ route, count });
    if (o.route !== 'home') return;
    yield {
      weight: Math.min(o.count, 4),
      act: (s) => s.page.click('#decrement'),
    };
  },
});

export const openSettings = defineAction({
  name: 'openSettings',
  *generate() {
    if ((yield* route) !== 'home') return;
    yield (s: CounterSurface) => s.page.click('#to-settings');
  },
});

export const setStep = defineAction({
  name: 'setStep',
  generate(n: number) {
    return (s) => s.page.click(`#step-${n}`);
  },
});

export const randomSetStep = defineAction({
  name: 'randomSetStep',
  *generate() {
    const o = yield* observe({ route, step });
    if (o.route !== 'settings') return;
    const n = yield* draw((rng) => [1, 5, 10][Math.floor(rng.next() * 3)]!);
    yield {
      weight: n === o.step ? 0 : 2,
      act: (s) => s.page.click(`#step-${n}`),
    };
  },
});

export const leaveSettings = defineAction({
  name: 'leaveSettings',
  *generate() {
    if ((yield* route) !== 'settings') return;
    yield (s: CounterSurface) => s.page.click('#back');
  },
});

export const openReset = defineAction({
  name: 'openReset',
  *generate() {
    const o = yield* observe({ route, count });
    if (o.route !== 'home' || o.count === 0) return;
    yield {
      weight: o.count > 100 ? 3 : 1,
      act: (s) => s.page.click('#reset'),
    };
  },
});

export const confirmReset = defineAction({
  name: 'confirmReset',
  *generate() {
    if ((yield* route) !== 'confirm-reset') return;
    yield (s: CounterSurface) => s.page.click('#confirm');
  },
});

export const reset = defineAction({
  name: 'reset',
  *generate() {
    yield* openReset;
    yield* confirmReset;
  },
});

export const COUNTER_ACTIONS = [
  increment,
  decrement,
  openSettings,
  randomSetStep,
  leaveSettings,
  openReset,
  confirmReset,
  reset,
] as const;

export const knownScreen = defineProperty({
  name: 'knownScreen',
  *watch() {
    const r = yield* route;
    if (!SCREENS.has(r)) throw new Error(`unknown screen ${r}`);
  },
});

export const nonNegative = defineProperty({
  name: 'nonNegative',
  *watch() {
    if ((yield* count) < 0) {
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
