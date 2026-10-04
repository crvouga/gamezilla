type DisposableKit = {
  dispose(): Promise<void>;
};

const openKits = new Set<DisposableKit>();
let installed = false;

/** Register a surface for afterEach leak disposal. */
export function registerKit(surface: DisposableKit): void {
  openKits.add(surface);
  ensureAfterEach();
}

/** Mark disposed so afterEach skips it. */
export function unregisterKit(surface: DisposableKit): void {
  openKits.delete(surface);
}

function ensureAfterEach(): void {
  if (installed) return;
  installed = true;
  try {
    // bun:test only — ignore when systems are opened outside the runner.
    const { afterEach } = require('bun:test') as {
      afterEach: (fn: () => unknown) => void;
    };
    afterEach(async () => {
      const pending = [...openKits];
      openKits.clear();
      for (const surface of pending) {
        try {
          await surface.dispose();
        } catch {
          // ignore double-dispose
        }
      }
    });
  } catch {
    installed = false;
  }
}
