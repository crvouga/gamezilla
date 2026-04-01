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

export function usePlaygroundBoot() {
  const [sim, setSim] = useState<PlaygroundSim | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [bootLabel, setBootLabel] = useState('Starting sync stack…');
  const [pulseKey, setPulseKey] = useState(0);
  const [linkEpoch, setLinkEpoch] = useState(0);
  const [, setClientEpoch] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const simRef = useRef<PlaygroundSim | null>(null);

  const bumpGraph = useCallback(() => setPulseKey((k) => k + 1), []);
  const bumpLink = useCallback(() => {
    setLinkEpoch((e) => e + 1);
    setPulseKey((k) => k + 1);
  }, []);

  const addClient = useCallback(async () => {
    const s = simRef.current;
    if (!s) return;
    await s.addClient();
    setClientEpoch((e) => e + 1);
    setPulseKey((k) => k + 1);
  }, []);

  const removeClient = useCallback(async (id: string) => {
    const s = simRef.current;
    if (!s) return;
    if (s.clients.length <= 1) return;
    await s.removeClient(id);
    setClientEpoch((e) => e + 1);
    setPulseKey((k) => k + 1);
  }, []);

  const reset = useCallback(async () => {
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
    setSim(null);
    setResetKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    setBootErr(null);
    setBootLabel('Starting sync stack…');

    void (async () => {
      await getSimTeardown();
      if (!mounted) return;
      setSim(null);

      try {
        const snapshot = await loadSnapshot();
        let p: PlaygroundSim;

        if (snapshot && snapshot.clients.length > 0) {
          setBootLabel('Restoring saved session…');
          p = await restorePlaygroundSim(snapshot, { dbFactory });
        } else {
          p = await createPlaygroundSim({
            clientCount: 2,
            dbFactory,
          });
          if (!mounted) {
            await p.destroy();
            return;
          }
          simRef.current = p;
          setBootLabel('Seeding shapes…');
          try {
            await seedPlaygroundShapes(p, { shapesPerClient: 2 });
          } catch (e) {
            simRef.current = null;
            if (!mounted) {
              await p.destroy();
              return;
            }
            setBootErr(e instanceof Error ? e.message : String(e));
            await p.destroy();
            return;
          }
        }

        if (!mounted) {
          simRef.current = null;
          await p.destroy();
          return;
        }
        simRef.current = p;
        setSim(p);
        setPulseKey((k) => k + 1);
      } catch (e: unknown) {
        if (!mounted) return;
        setBootErr(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      mounted = false;
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
    };
  }, [resetKey]);

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
