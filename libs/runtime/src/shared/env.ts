import type { Clock } from '@pkgs/clock';
import type { Kv } from '@pkgs/kv/interface';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

export type Fetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type ClientEnvironment = {
  api: Fetch;
  events: PubSub;
  db: SqlClient;
  kv: Kv;
  blob: ObjectStore;
  clock: Clock;
  createId: () => string;
  room: WebSocket;
};

export type ServerEnvironment = {
  db: SqlClient;
  events: PubSub;
  kv: Kv;
  blob: ObjectStore;
  clock: Clock;
  createId: () => string;
  random: () => number;
  seed: bigint;
};

/* 

declare function createClient(env: ClientEnv): Client;
declare function createServer(env: ServerEnv): Server;

const sim = createSim()

*/
