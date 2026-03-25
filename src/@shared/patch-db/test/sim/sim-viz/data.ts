import type {
  SimRecording,
  SimEvent,
  Snapshot,
  NodeRow,
  ConsistencyStatus,
  SimTopology,
} from './types';

export function sortRecordings(raw: unknown): SimRecording[] {
  const arr = Array.isArray(raw) ? (raw as SimRecording[]).slice() : [];
  arr.sort(
    (a, b) =>
      (a.meta?.title || a.id).localeCompare(b.meta?.title || b.id) ||
      a.id.localeCompare(b.id)
  );
  return arr;
}

export function getOrderedEvents(rec: SimRecording): SimEvent[] {
  return rec.events.slice().sort((a, b) => a.seq - b.seq);
}

function mergeSummariesInto(
  store: Record<string, { entityType: string; attrs: Record<string, boolean> }>,
  summaries?: { entityId: string; entityType: string; attributeKeys?: string[] }[]
): void {
  if (!summaries) return;
  for (const s of summaries) {
    let row = store[s.entityId];
    if (!row) {
      row = { entityType: s.entityType, attrs: {} };
      store[s.entityId] = row;
    }
    for (const k of s.attributeKeys || []) row.attrs[k] = true;
  }
}

export function replayNodeStates(rec: SimRecording, count: number): Snapshot {
  const topo = rec.topology;
  const srvS: Record<string, Record<string, { entityType: string; attrs: Record<string, boolean> }>> = {};
  const cliS: Record<string, Record<string, { entityType: string; attrs: Record<string, boolean> }>> = {};
  const cliPart: Record<string, boolean> = {};
  const cliPoll: Record<string, { results: any[] } | null> = {};
  const srv4cli: Record<string, string> = {};

  for (const s of topo.servers) srvS[s.id] = {};
  for (const c of topo.clients) {
    cliS[c.id] = {};
    cliPart[c.id] = false;
    cliPoll[c.id] = null;
    srv4cli[c.id] = c.serverId;
  }

  const ordered = getOrderedEvents(rec);
  const n = Math.max(0, Math.min(count, ordered.length));

  for (let i = 0; i < n; i++) {
    const e = ordered[i]!;
    switch (e.type) {
      case 'client_write':
        mergeSummariesInto(cliS[e.clientId!]!, e.summaries);
        break;
      case 'server_write':
        mergeSummariesInto(srvS[e.serverId!]!, e.summaries);
        break;
      case 'remote_write': {
        const sid = srv4cli[e.clientId!];
        if (sid) mergeSummariesInto(srvS[sid]!, e.summaries);
        mergeSummariesInto(cliS[e.clientId!]!, e.summaries);
        break;
      }
      case 'remote_read':
        cliPoll[e.clientId!] = { results: e.results ?? [] };
        if (e.summaries) mergeSummariesInto(cliS[e.clientId!]!, e.summaries);
        break;
      case 'partition':
        cliPart[e.clientId!] = true;
        break;
      case 'heal':
        cliPart[e.clientId!] = false;
        break;
    }
  }

  const toRows = (
    s: Record<string, { entityType: string; attrs: Record<string, boolean> }>
  ): NodeRow[] =>
    Object.keys(s)
      .sort()
      .map((id) => ({
        entityId: id,
        entityType: s[id]!.entityType,
        attrs: Object.keys(s[id]!.attrs).sort(),
      }));

  return {
    servers: topo.servers.map((s) => ({ id: s.id, rows: toRows(srvS[s.id]!) })),
    clients: topo.clients.map((c) => ({
      id: c.id,
      serverId: c.serverId,
      partitioned: cliPart[c.id]!,
      rows: toRows(cliS[c.id]!),
      lastPoll: cliPoll[c.id]!,
    })),
  };
}

export function checkConsistency(
  rec: SimRecording,
  step: number
): ConsistencyStatus {
  const snap = replayNodeStates(rec, step);
  const ordered = getOrderedEvents(rec);
  const applied = ordered.slice(0, step);

  const srvMap: Record<string, (typeof snap.servers)[number]> = {};
  for (const s of snap.servers) srvMap[s.id] = s;

  let allMatch = true,
    anyOnline = false,
    pendingOps = false;
  const openPush: Record<string, boolean> = {};
  const openPoll: Record<string, boolean> = {};

  for (const e of applied) {
    if (e.type === 'push_start') openPush[e.clientId!] = true;
    if (e.type === 'push_success' || e.type === 'push_fail')
      delete openPush[e.clientId!];
    if (e.type === 'poll_start') openPoll[e.clientId!] = true;
    if (e.type === 'poll_success' || e.type === 'poll_fail')
      delete openPoll[e.clientId!];
  }

  for (const c of snap.clients) {
    if (c.partitioned) continue;
    anyOnline = true;
    if (openPush[c.id] || openPoll[c.id]) {
      pendingOps = true;
      continue;
    }
    const srv = srvMap[c.serverId];
    if (!srv) { allMatch = false; continue; }
    const srvIds = new Set(srv.rows.map((r) => r.entityId));
    const cliIds = new Set(c.rows.map((r) => r.entityId));
    if (srvIds.size !== cliIds.size) { allMatch = false; continue; }
    for (const id of srvIds) {
      if (!cliIds.has(id)) { allMatch = false; break; }
    }
    if (!allMatch) break;
    const srvAttrs: Record<string, string> = {};
    for (const r of srv.rows) srvAttrs[r.entityId] = r.attrs.join(',');
    for (const r of c.rows) {
      if (srvAttrs[r.entityId] !== r.attrs.join(',')) {
        allMatch = false;
        break;
      }
    }
    if (!allMatch) break;
  }

  if (step === 0) return 'idle';
  if (!anyOnline) return 'partitioned';
  if (pendingOps) return 'syncing';
  return allMatch ? 'consistent' : 'inconsistent';
}

export type EntityDiffLine = {
  attr: string;
  allConsistent: boolean;
  nodesWith: string[];
  nodesWithout: string[];
};

export type EntityDiff = {
  entityId: string;
  entityType: string;
  perNode: Record<string, { type: string; attrs: Set<string> }>;
  missingOn: string[];
  attrLines: EntityDiffLine[];
  hasDiff: boolean;
};

export type DiffResult = {
  entities: EntityDiff[];
  nodeIds: string[];
  nodeLabels: Record<string, string>;
};

export function buildEntityDiff(
  snapshot: Snapshot | null,
  _topo: SimTopology | undefined
): DiffResult {
  if (!snapshot) return { entities: [], nodeIds: [], nodeLabels: {} };

  const nodeMap: Record<string, Record<string, { type: string; attrs: Set<string> }>> = {};
  const nodeIds: string[] = [];
  const nodeLabels: Record<string, string> = {};

  for (const s of snapshot.servers) {
    const nid = 's:' + s.id;
    nodeIds.push(nid);
    nodeLabels[nid] = 'server:' + s.id;
    const m: Record<string, { type: string; attrs: Set<string> }> = {};
    for (const r of s.rows)
      m[r.entityId] = { type: r.entityType, attrs: new Set(r.attrs) };
    nodeMap[nid] = m;
  }
  for (const c of snapshot.clients) {
    const nid = 'c:' + c.id;
    nodeIds.push(nid);
    nodeLabels[nid] = 'client:' + c.id;
    const m: Record<string, { type: string; attrs: Set<string> }> = {};
    for (const r of c.rows)
      m[r.entityId] = { type: r.entityType, attrs: new Set(r.attrs) };
    nodeMap[nid] = m;
  }

  const allEntityIds = new Set<string>();
  for (const nid of nodeIds)
    for (const eid of Object.keys(nodeMap[nid]!)) allEntityIds.add(eid);

  const entities: EntityDiff[] = [];
  for (const eid of [...allEntityIds].sort()) {
    const perNode: Record<string, { type: string; attrs: Set<string> }> = {};
    let anyType = '';
    for (const nid of nodeIds) {
      const e = nodeMap[nid]![eid];
      if (e) { perNode[nid] = e; anyType = e.type; }
    }
    const presentOn = Object.keys(perNode);
    const missingOn = nodeIds.filter((n) => !perNode[n]);
    const entityDiffers = missingOn.length > 0;

    const allAttrs = new Set<string>();
    for (const nid of nodeIds) {
      const e = perNode[nid];
      if (e) e.attrs.forEach((a) => allAttrs.add(a));
    }

    const attrLines: EntityDiffLine[] = [...allAttrs].sort().map((attr) => {
      const nodesWith = nodeIds.filter((n) => perNode[n]?.attrs.has(attr));
      const nodesWithout = nodeIds.filter(
        (n) => perNode[n] && !perNode[n]!.attrs.has(attr)
      );
      const allPresent =
        nodesWith.length === presentOn.length && missingOn.length === 0;
      return { attr, allConsistent: allPresent, nodesWith, nodesWithout };
    });

    const hasDiff = entityDiffers || attrLines.some((l) => !l.allConsistent);
    entities.push({ entityId: eid, entityType: anyType, perNode, missingOn, attrLines, hasDiff });
  }
  return { entities, nodeIds, nodeLabels };
}
