import type {
  Patch,
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
} from '../interface';

/** Client-side transport port: stateless remote read/write over HTTP. */
export type PatchDbClientTransport = {
  read(queries: PatchDbQuery[], ctx?: PatchDbContext): Promise<PatchDbResult[]>;
  write(patches: PatchInput[], ctx?: PatchDbContext): Promise<Patch[]>;
};

/** Authority-side sync port: merge known patches, read, and write. */
export type PatchDbSyncHost = {
  read(queries: PatchDbQuery[], ctx?: PatchDbContext): Promise<PatchDbResult[]>;
  write(patches: PatchInput[], ctx?: PatchDbContext): Promise<Patch[]>;
};
