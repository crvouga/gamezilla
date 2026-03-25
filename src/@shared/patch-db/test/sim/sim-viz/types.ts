export type Point = { x: number; y: number };

export type PatchInputSummary = {
  entityId: string;
  entityType: string;
  attributeKeys: string[];
};

export type ResultSummary = {
  entityCount: number;
  patchCount: number;
};

export type SimTopology = {
  servers: { id: string; useSyncHost: boolean }[];
  clients: { id: string; serverId: string }[];
};

export type SimRecordingMeta = {
  title?: string;
  description?: string;
  intent?: string;
};

export type SimEvent = {
  type: string;
  seq: number;
  time: number;
  clientId?: string;
  serverId?: string;
  patchCount?: number;
  summaries?: PatchInputSummary[];
  returnedPatchCount?: number;
  results?: ResultSummary[];
  op?: string;
  phase?: string;
  ok?: boolean;
  reason?: string;
  mode?: string;
  source?: string;
  topology?: SimTopology;
};

export type SimRecording = {
  id: string;
  topology: SimTopology;
  events: SimEvent[];
  meta?: SimRecordingMeta;
};

export type NodeRow = {
  entityId: string;
  entityType: string;
  attrs: string[];
};

export type ServerSnapshot = { id: string; rows: NodeRow[] };

export type ClientSnapshot = {
  id: string;
  serverId: string;
  partitioned: boolean;
  rows: NodeRow[];
  lastPoll: { results: ResultSummary[] } | null;
};

export type Snapshot = {
  servers: ServerSnapshot[];
  clients: ClientSnapshot[];
};

export type LayoutLink = { s: string; c: string; clientId: string };

export type Layout = {
  pos: Record<string, Point>;
  links: LayoutLink[];
  W: number;
  H: number;
};

export type EdgeGeo = { d: string; ctrl: Point; mid: Point };

export type ConsistencyStatus =
  | 'idle'
  | 'consistent'
  | 'inconsistent'
  | 'syncing'
  | 'partitioned';
