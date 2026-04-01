import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Entity } from '@gamezilla/patch-db/interface';
import { shapeListQuery } from '@gamezilla/patch-db/sim/playground-shapes';
import type { PlaygroundSim } from '@gamezilla/patch-db/sim/playground-sim';

const SERVER_POLL_MS = 900;

export function useServerShapes(sim: PlaygroundSim) {
  const query = useMemo(() => shapeListQuery(), []);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [readError, setReadError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void sim.serverBacking
      .read([query])
      .then((r) => {
        setEntities(r[0]?.entities ?? []);
        setReadError(null);
      })
      .catch((err: unknown) => {
        setReadError(
          `Read failed: ${err instanceof Error ? err.message : String(err)}`
        );
        setEntities([]);
      });
  }, [sim, query]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, SERVER_POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { entities, readError, refresh } as const;
}
