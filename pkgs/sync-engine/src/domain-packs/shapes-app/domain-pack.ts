import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SimDomainPack } from '../../sim/domain-pack';
import type { InvariantViolation } from '../../sim/invariants';
import { readLiveShapes, shapesMatch } from './assert';
import { shapesLocalSchema } from './client/local-schema';
import {
  shapesMutationRegistry,
  shapesQueryRegistry,
} from './shared/registries';
import { shapesDefaultEntryChannel, shapesTopicMap } from './shared/topic-map';

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

export const shapesDomainPack: SimDomainPack = {
  localSchema: shapesLocalSchema,
  mutationRegistry: shapesMutationRegistry,
  queryRegistry: shapesQueryRegistry,
  sessionQuery: { name: 'shapesWorld', params: {} },
  checkAllConverged: checkShapesConverged,
  topicMap: shapesTopicMap,
  defaultEntryChannel: shapesDefaultEntryChannel,
};
