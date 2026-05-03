import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { expoSqlitePlaygroundDbFactory } from '@gamezilla/patch-db/sim/playground-db-factory-expo';
import { seedPlaygroundShapes } from '@gamezilla/patch-db/sim/playground-shapes';
import type { PlaygroundSim } from '@gamezilla/patch-db/sim/playground-sim';
import {
  createPlaygroundSim,
  restorePlaygroundSim,
} from '@gamezilla/patch-db/sim/playground-sim';
import { clearSnapshot, loadSnapshot, saveSnapshot } from './persist';

const dbFactory = expoSqlitePlaygroundDbFactory();

const SIM_TEARDOWN_KEY = Symbol.for('playground-sim-teardown');

function getSimTeardown(): Promise<void> {
  return (
    (globalThis as unknown as Record<symbol, Promise<void>>)[
      SIM_TEARDOWN_KEY
    ] ?? Promise.resolve()
  );
}

function setSimTeardown(p: Promise<void>): void {
  (globalThis as unknown as Record<symbol, Promise<void>>)[SIM_TEARDOWN_KEY] =
    p;
}

type BootHandlers = {
  isMounted: () => boolean;
  setBootLabel: (s: string) => void;
  setBootErr: (s: string | null) => void;
  simRef: React.MutableRefObject<PlaygroundSim | null>;
};

async function createFreshSim(
  handlers: BootHandlers
): Promise<PlaygroundSim | null> {
  const p = await createPlaygroundSim({ clientCount: 2, dbFactory });
  if (!handlers.isMounted()) {
    await p.destroy();
    return null;
  }
  handlers.simRef.current = p;
  handlers.setBootLabel('Seeding shapes…');
  try {
    await seedPlaygroundShapes(p, { shapesPerClient: 2 });
  } catch (e) {
    handlers.simRef.current = null;
    if (!handlers.isMounted()) {
      await p.destroy();
      return null;
    }
    handlers.setBootErr(e instanceof Error ? e.message : String(e));
    await p.destroy();
    return null;
  }
  return p;
}

async function buildSim(handlers: BootHandlers): Promise<PlaygroundSim | null> {
  const snapshot = await loadSnapshot();
  if (snapshot && snapshot.clients.length > 0) {
    handlers.setBootLabel('Restoring saved session…');
    return restorePlaygroundSim(snapshot, { dbFactory });
  }
  return createFreshSim(handlers);
}

async function runBoot(
  handlers: BootHandlers,
  setSim: (s: PlaygroundSim | null) => void,
  bumpPulse: () => void
): Promise<void> {
  await getSimTeardown();
  if (!handlers.isMounted()) return;
  setSim(null);
  try {
    const p = await buildSim(handlers);
    if (p === null) return;
    if (!handlers.isMounted()) {
      handlers.simRef.current = null;
      await p.destroy();
      return;
    }
    handlers.simRef.current = p;
    setSim(p);
    bumpPulse();
  } catch (e: unknown) {
    if (!handlers.isMounted()) return;
    handlers.setBootErr(e instanceof Error ? e.message : String(e));
  }
}

function scheduleTeardown(
  simRef: React.MutableRefObject<PlaygroundSim | null>
) {
  const x = simRef.current;
  simRef.current = null;
  if (x) {
    try {
      saveSnapshot(x.takeSnapshot()).catch(() => {});
    } catch {
      // may fail if already destroyed
    }
  }
  const prev = getSimTeardown();
  setSimTeardown(
    prev.then(() =>
      x !== null && x !== undefined ? x.destroy() : Promise.resolve()
    )
  );
}

function useSnapshotSaver(sim: PlaygroundSim | null) {
  useEffect(() => {
    if (!sim) return;
    const save = () => {
      try {
        saveSnapshot(sim.takeSnapshot()).catch(() => {});
      } catch {
        // may fail if sim is mid-teardown
      }
    };
    const id = setInterval(save, 5000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        save();
      }
    });
    return () => {
      clearInterval(id);
      subscription.remove();
    };
  }, [sim]);
}

function useSimActions(
  simRef: React.MutableRefObject<PlaygroundSim | null>,
  setPulseKey: React.Dispatch<React.SetStateAction<number>>,
  setLinkEpoch: React.Dispatch<React.SetStateAction<number>>,
  setClientEpoch: React.Dispatch<React.SetStateAction<number>>
) {
  const bumpGraph = useCallback(() => setPulseKey((k) => k + 1), [setPulseKey]);
  const bumpLink = useCallback(() => {
    setLinkEpoch((e) => e + 1);
    setPulseKey((k) => k + 1);
  }, [setLinkEpoch, setPulseKey]);

  const addClient = useCallback(async () => {
    const s = simRef.current;
    if (!s) return;
    await s.addClient();
    setClientEpoch((e) => e + 1);
    setPulseKey((k) => k + 1);
  }, [simRef, setClientEpoch, setPulseKey]);

  const removeClient = useCallback(
    async (id: string) => {
      const s = simRef.current;
      if (!s) return;
      if (s.clients.length <= 1) return;
      await s.removeClient(id);
      setClientEpoch((e) => e + 1);
      setPulseKey((k) => k + 1);
    },
    [simRef, setClientEpoch, setPulseKey]
  );

  return { bumpGraph, bumpLink, addClient, removeClient };
}

async function performReset(
  simRef: React.MutableRefObject<PlaygroundSim | null>
) {
  const s = simRef.current;
  simRef.current = null;
  const snapshot = s?.takeSnapshot();
  if (s) await s.destroy();
  if (snapshot) {
    const labels = [
      `playground_${snapshot.serverId}`,
      ...snapshot.clients.map((c) => `playground_${c.id}`),
    ];
    await dbFactory.removeAll(labels);
  }
  await clearSnapshot();
}

type BootEffectArgs = {
  resetKey: number;
  simRef: React.MutableRefObject<PlaygroundSim | null>;
  setSim: (s: PlaygroundSim | null) => void;
  setBootErr: (s: string | null) => void;
  setBootLabel: (s: string) => void;
  setPulseKey: React.Dispatch<React.SetStateAction<number>>;
};

function useBootEffect(args: BootEffectArgs) {
  const { resetKey, simRef, setSim, setBootErr, setBootLabel, setPulseKey } =
    args;
  useEffect(() => {
    let mounted = true;
    setBootErr(null);
    setBootLabel('Starting sync stack…');
    const handlers: BootHandlers = {
      isMounted: () => mounted,
      setBootLabel,
      setBootErr,
      simRef,
    };
    void runBoot(handlers, setSim, () => setPulseKey((k) => k + 1));
    return () => {
      mounted = false;
      scheduleTeardown(simRef);
    };
  }, [resetKey, setSim, setBootErr, setBootLabel, setPulseKey, simRef]);
}

export function usePlaygroundBoot() {
  const [sim, setSim] = useState<PlaygroundSim | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [bootLabel, setBootLabel] = useState('Starting sync stack…');
  const [pulseKey, setPulseKey] = useState(0);
  const [linkEpoch, setLinkEpoch] = useState(0);
  const [, setClientEpoch] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const simRef = useRef<PlaygroundSim | null>(null);

  const { bumpGraph, bumpLink, addClient, removeClient } = useSimActions(
    simRef,
    setPulseKey,
    setLinkEpoch,
    setClientEpoch
  );

  const reset = useCallback(async () => {
    await performReset(simRef);
    setSim(null);
    setResetKey((k) => k + 1);
  }, []);

  useBootEffect({
    resetKey,
    simRef,
    setSim,
    setBootErr,
    setBootLabel,
    setPulseKey,
  });

  useSnapshotSaver(sim);

  return {
    sim,
    bootErr,
    bootLabel,
    pulseKey,
    linkEpoch,
    bumpGraph,
    bumpLink,
    addClient,
    removeClient,
    reset,
  } as const;
}
