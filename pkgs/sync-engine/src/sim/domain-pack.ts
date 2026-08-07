import type { SqlClient } from '@pkgs/sql-client/interface';

import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { InvariantViolation } from './invariants';
import {
  checkAllClientsConverged,
  checkClientDomainMatchServer,
} from './invariants';
import {
  notesLocalSchema,
  notesMutationRegistry,
  notesQueryRegistry,
} from './notes-app';
import {
  readLiveShapes,
  shapesLocalSchema,
  shapesMatch,
  shapesMutationRegistry,
  shapesQueryRegistry,
} from './shapes-app';

export type SimSessionQuery = {
  readonly name: string;
  readonly params: Record<string, unknown>;
};

/**
 * Pluggable domain for a sim world (schema + registries + converge check).
 * Default is notes-app; the sim lab uses shapes-app.
 */
export type SimDomainPack = {
  readonly id: 'notes' | 'shapes';
  readonly localSchema: LocalDomainSchema;
  readonly mutationRegistry: MutationRegistry;
  readonly queryRegistry: QueryRegistry;
  readonly sessionQuery: SimSessionQuery;
  readonly checkAllConverged: (args: {
    readonly clients: readonly {
      readonly label: string;
      readonly db: SqlClient;
    }[];
    readonly serverDb: SqlClient;
  }) => Promise<InvariantViolation | null>;
};

async function checkShapesConverged(args: {
  readonly clients: readonly {
    readonly label: string;
    readonly db: SqlClient;
  }[];
  readonly serverDb: SqlClient;
}): Promise<InvariantViolation | null> {
  const serverShapes = await readLiveShapes(args.serverDb);
  const serverKey = JSON.stringify(serverShapes);
  for (const client of args.clients) {
    const ok = await shapesMatch(client.db, args.serverDb);
    if (!ok) {
      const local = await readLiveShapes(client.db);
      return {
        invariant: 'convergence',
        detail: `${client.label} shapes diverge from server local=${JSON.stringify(local)} server=${serverKey}`,
      };
    }
  }
  return null;
}

export const notesDomainPack: SimDomainPack = {
  id: 'notes',
  localSchema: notesLocalSchema,
  mutationRegistry: notesMutationRegistry,
  queryRegistry: notesQueryRegistry,
  sessionQuery: { name: 'notesWorld', params: {} },
  checkAllConverged: checkAllClientsConverged,
};

export const shapesDomainPack: SimDomainPack = {
  id: 'shapes',
  localSchema: shapesLocalSchema,
  mutationRegistry: shapesMutationRegistry,
  queryRegistry: shapesQueryRegistry,
  sessionQuery: { name: 'shapesWorld', params: {} },
  checkAllConverged: checkShapesConverged,
};

export function resolveDomainPack(
  id: 'notes' | 'shapes' | undefined
): SimDomainPack {
  return id === 'shapes' ? shapesDomainPack : notesDomainPack;
}

/** @deprecated Prefer pack.checkAllConverged */
export { checkClientDomainMatchServer };
