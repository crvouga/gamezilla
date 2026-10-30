import type { Timers } from '@pkgs/clock-shared-ts/types';

type BrowserStorageEvidencePorts = {
  readonly pathname: string;
  readonly readIdentity: (key: string) => string | null;
  readonly directories: () => Promise<
    AsyncIterable<readonly [string, { readonly kind: string }]>
  >;
  readonly timers: Pick<Timers, 'setTimeout' | 'clearTimeout'>;
};

/** Read identifiers and directory names only; never open SQLite or enumerate storage values. */
export async function captureBrowserStorageEvidence(
  ports: BrowserStorageEvidencePorts
): Promise<string> {
  const identity = (key: string): string | null => {
    try {
      const value = ports.readIdentity(key);
      return value !== null &&
        /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value)
        ? value
        : null;
    } catch {
      return null;
    }
  };
  const state = {
    pathname: ports.pathname.slice(0, 256),
    accountId: identity('lastLocalAccountId'),
    deviceId: identity('deviceId'),
    databases: [] as string[],
    opfs: 'unavailable',
  };
  let stopped = false;
  let timer: unknown;
  const deadline = new Promise<void>((resolve) => {
    timer = ports.timers.setTimeout(() => {
      stopped = true;
      state.opfs = 'timeout';
      resolve();
    }, 1_000);
  });
  const collect = async (): Promise<void> => {
    try {
      const entries = await ports.directories();
      let scanned = 0;
      for await (const [name, entry] of entries) {
        if (stopped) return;
        if (entry.kind === 'directory' && /^user_[a-f0-9]{12}$/.test(name))
          state.databases.push(name);
        if (++scanned >= 32 || state.databases.length >= 8) break;
      }
      if (!stopped) state.opfs = 'available';
    } catch {
      // Preserve the original journey failure even when storage cannot be read.
    }
  };
  try {
    await Promise.race([collect(), deadline]);
    return JSON.stringify(state);
  } finally {
    stopped = true;
    ports.timers.clearTimeout(timer);
  }
}

/** Browser wall ports; the capture itself has injected I/O and a one-second deadline. */
export const BROWSER_FAILURE_STORAGE = `(${captureBrowserStorageEvidence.toString()})({
  pathname: location.pathname,
  readIdentity: key => localStorage.getItem(key),
  directories: async () => {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle('sqlite-web', { create: false });
    return directory.entries();
  },
  timers: { setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms), clearTimeout: id => globalThis.clearTimeout(id) }
})`;

/** A parked renderer cannot hold failure reporting open indefinitely. */
export async function readBrowserStorageEvidence(
  evaluate: (script: string) => Promise<unknown>,
  timers: Pick<Timers, 'setTimeout' | 'clearTimeout'>
): Promise<string> {
  let timer: unknown;
  const timeout = new Promise<string>((resolve) => {
    timer = timers.setTimeout(() => resolve('timeout'), 1_500);
  });
  try {
    return await Promise.race([
      evaluate(BROWSER_FAILURE_STORAGE).then(
        (value) =>
          typeof value === 'string' ? value.slice(0, 2_000) : 'unavailable',
        () => 'unavailable'
      ),
      timeout,
    ]);
  } catch {
    return 'unavailable';
  } finally {
    timers.clearTimeout(timer);
  }
}

/** Failure logs retain rendered state even when the release profile keeps no reports. */
export function browserFailureSummary(html: string): string {
  const controls =
    html.match(/<[^>]*data-testid="multiplayer-[^"]+"[^>]*>/g) ?? [];
  const omit = /multiplayer-(?:board-|rating-|time-control-)/;
  const state = controls
    .filter((tag) => !omit.test(tag))
    .map((tag) =>
      tag.match(
        /data-(?:testid|game-id|outcome|revision|reason|phase|can-move|board-takes-moves)="[^"]*"/g
      )
    );
  const waiting = html
    .match(/data-testid="multiplayer-waiting"[^>]*>([\s\S]*?)<\/p>/)?.[1]
    ?.replace(/<[^>]*>/g, ' ');
  return JSON.stringify({
    screen: html.match(/data-screen="([^"]+)"/)?.[1],
    controls: state,
    waiting,
    text: html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(-2000),
  });
}

/** Only rendered geometry and sanitized control identifiers, never input values. */
export const BROWSER_FAILURE_LAYOUT = `(() => {
  const describe = el => el && ({ tag: el.tagName, component: el.dataset.component, testid: el.dataset.testid });
  return JSON.stringify({ visibility: document.visibilityState, width: innerWidth, height: innerHeight,
    controls: Array.from(document.querySelectorAll('[data-testid="multiplayer-find"]')).map(el => {
      const rect = el.getBoundingClientRect();
      const parents = [];
      for (let p = el; p !== null; p = p.parentElement) {
        const style = getComputedStyle(p);
        parents.push({ ...describe(p), rect: p.getBoundingClientRect().toJSON(), scrollTop: p.scrollTop,
          scrollHeight: p.scrollHeight, clientHeight: p.clientHeight, overflow: style.overflowY, position: style.position, opacity: style.opacity });
      }
      return { rect: rect.toJSON(), disabled: el.disabled, parents,
        hit: describe(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
    }) });
})()`;

/** CI retains the log tail: keep every device's screen after verbose transports. */
export function browserFailureLog(
  details: readonly string[],
  summaries: readonly string[]
): string {
  return [...details, ...summaries].join('\n');
}
