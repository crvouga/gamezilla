import type { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import type { Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import type { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import type { SyncPatchDb } from '../impl-sync';
import type {
  PatchDb,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import type { NetworkLink } from './network-link';
import type { SimServerPort } from './server-port';
import type { SimulatedPatchDbClientTransport } from './simulated-client-transport';

export type ScenarioServerSpec = {
  id: string;
};

export type ScenarioClientSpec = {
  id: string;
  serverId: string;
};

export type ServerRuntime = {
  id: string;
  sql: SqlClient;
  backing: PatchDbImplSqlite;
  pubSub: InMemoryPubSub;
  port: SimServerPort;
};

export type ClientRuntime = {
  id: string;
  serverId: string;
  sqlClient: SqlClient;
  localDb: PatchDbImplSqlite;
  transport: SimulatedPatchDbClientTransport;
  remoteDb: PatchDb;
  syncDb: SyncPatchDb;
  pubSub: InMemoryPubSub;
  link: NetworkLink;
  vizUnsubs: Unsubscribe[];
};

export type SimLink = {
  partition(): void;
  heal(): void;
  failNextRead(err?: Error): void;
  failNextWrite(err?: Error): void;
  setLatency(ms: number): void;
  getLatency(): number;
  setInvalidationLatency(ms: number): void;
  isPartitioned(): boolean;
};

export type SimClient = {
  id: string;
  /** Write patches to local (unsynced). */
  write(patches: PatchInput[]): Promise<WritePatchesResult>;
  /** Read from local db. */
  read(queries: PatchDbQuery[]): Promise<PatchDbResult[]>;
  /** Run one push cycle + flush microtasks. */
  push(): Promise<void>;
  /** Run one poll cycle + flush microtasks. */
  poll(): Promise<void>;
  /** Wipe all local data (simulate catastrophic client data loss). */
  wipeStorage(): Promise<void>;
  subscribe: SyncPatchDb['subscribe'];
  link: SimLink;
  /** Escape hatch: raw SyncPatchDb (for edge-case tests). */
  syncDb: SyncPatchDb;
};

export type SimServer = {
  id: string;
  /** The authority PatchDb (write here to simulate other clients). */
  db: PatchDb;
  /** Wipe all server data (simulate catastrophic server data loss). */
  wipeStorage(): Promise<void>;
};
