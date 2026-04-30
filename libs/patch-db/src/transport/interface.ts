import type {
  Patch,
  PatchesDbContext,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';

/** Client-side transport port: stateless remote read/write over HTTP. */
export type PatchDbClientTransport = {
  read(
    queries: PatchesDbQuery[],
    ctx?: PatchesDbContext
  ): Promise<PatchesDbResult[]>;
  write(patches: PatchInput[], ctx?: PatchesDbContext): Promise<Patch[]>;
};

/** Authority-side sync port: merge known patches, read, and write. */
export type PatchDbSyncHost = {
  read(
    queries: PatchesDbQuery[],
    ctx?: PatchesDbContext
  ): Promise<PatchesDbResult[]>;
  write(patches: PatchInput[], ctx?: PatchesDbContext): Promise<Patch[]>;
};
