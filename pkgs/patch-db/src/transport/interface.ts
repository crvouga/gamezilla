import type {
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';

/** Client-side transport: remote read/write over HTTP or in-process host. */
export type PatchDbClientTransport = {
  read(queries: PatchDbQuery[], ctx?: PatchDbContext): Promise<PatchDbResult[]>;
  write(
    patches: PatchInput[],
    ctx?: PatchDbContext
  ): Promise<WritePatchesResult>;
};

/** Authority-side sync port: same as {@link PatchDb} read/write for wire handlers. */
export type PatchDbSyncHost = {
  read(queries: PatchDbQuery[], ctx?: PatchDbContext): Promise<PatchDbResult[]>;
  write(
    patches: PatchInput[],
    ctx?: PatchDbContext
  ): Promise<WritePatchesResult>;
};
