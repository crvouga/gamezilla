import type { PatchesDbRead, PatchesDbWrite } from '../interface';

/** Client-side transport port: stateless remote read/write over HTTP. */
export type PatchDbClientTransport = PatchesDbRead & PatchesDbWrite;

/** Authority-side sync port: merge known patches, read, and write. */
export type PatchDbSyncHost = PatchesDbRead & PatchesDbWrite;
