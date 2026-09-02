import type { KnobValues, World } from '@pkgs/dst';

import type {
  SCHEMA_CLIENT_COUNT,
  schemaClientNode,
  schemaServerNode,
} from './nodes';
import type { SCHEMA_SERVER_ID } from './peers';

export type SchemaKnobs = {
  readonly clientCount: typeof SCHEMA_CLIENT_COUNT;
};

export type SchemaNodes = {
  readonly server: typeof schemaServerNode & {
    readonly id: () => typeof SCHEMA_SERVER_ID;
  };
  readonly client: typeof schemaClientNode & {
    readonly count: (knobs: KnobValues<SchemaKnobs>) => number;
    readonly id: (index: number) => string;
  };
};

export type SchemaSurface = World<SchemaKnobs, SchemaNodes>;
