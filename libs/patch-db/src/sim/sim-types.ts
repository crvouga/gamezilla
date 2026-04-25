import type { Unsubscribe } from '@gamezilla/lib/pub-sub/interface';
import type { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import type { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import type { SyncPatchesDb } from '../impl-sync';
import type {
  Patch,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
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
  remoteDb: PatchesDb;
  syncDb: SyncPatchesDb;
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
  write(patches: PatchInput[]): Promise<Patch[]>;
  /** Read from local db. */
  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]>;
  /** Run one push cycle + flush microtasks. */
  push(): Promise<void>;
  /** Run one poll cycle + flush microtasks. */
  poll(): Promise<void>;
  /** Wipe all local data (simulate catastrophic client data loss). */
  wipeStorage(): Promise<void>;
  subscribe: SyncPatchesDb['subscribe'];
  link: SimLink;
  /** Escape hatch: raw SyncPatchesDb (for edge-case tests). */
  syncDb: SyncPatchesDb;
};

export type SimServer = {
  id: string;
  /** The authority PatchesDb (write here to simulate other clients). */
  db: PatchesDb;
  /** Wipe all server data (simulate catastrophic server data loss). */
  wipeStorage(): Promise<void>;
};
