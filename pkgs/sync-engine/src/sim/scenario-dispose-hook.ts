type DisposableWorld = {
  dispose(): Promise<void>;
};

const openWorlds = new Set<DisposableWorld>();
let installed = false;

/** Register a world for afterEach leak disposal. */
export function registerSimWorld(world: DisposableWorld): void {
  openWorlds.add(world);
  ensureAfterEach();
}

/** Mark disposed so afterEach skips it. */
export function unregisterSimWorld(world: DisposableWorld): void {
  openWorlds.delete(world);
}

function ensureAfterEach(): void {
  if (installed) return;
  installed = true;
  try {
    // bun:test only — ignore when openSimWorld is used outside the runner.
    const { afterEach } = require('bun:test') as {
      afterEach: (fn: () => unknown) => void;
    };
    afterEach(async () => {
      const pending = [...openWorlds];
      openWorlds.clear();
      for (const world of pending) {
        try {
          await world.dispose();
        } catch {
          // ignore double-dispose
        }
      }
    });
  } catch {
    installed = false;
  }
}
