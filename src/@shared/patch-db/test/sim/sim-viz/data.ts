import { assert } from '@/@shared/assert';
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
    const e = ordered[i];
    assert.defined(e, 'replayNodeStates: event in range', { i, n });
    switch (e.type) {
      case 'client_write': {
        const cid = e.clientId;
        assert.defined(cid, 'client_write: clientId', { seq: e.seq });
        const store = cliS[cid];
        assert.defined(store, 'client_write: client store', { cid });
        mergeSummariesInto(store, e.summaries);
        break;
      }
      case 'server_write': {
        const sid = e.serverId;
        assert.defined(sid, 'server_write: serverId', { seq: e.seq });
        const store = srvS[sid];
        assert.defined(store, 'server_write: server store', { sid });
        mergeSummariesInto(store, e.summaries);
        break;
      }
      case 'remote_write': {
        const cid = e.clientId;
        assert.defined(cid, 'remote_write: clientId', { seq: e.seq });
        const srvId = srv4cli[cid];
        if (srvId) {
          const srvStore = srvS[srvId];
          assert.defined(srvStore, 'remote_write: server store', {
            srvId,
            cid,
          });
          mergeSummariesInto(srvStore, e.summaries);
        }
        const cliStore = cliS[cid];
        assert.defined(cliStore, 'remote_write: client store', { cid });
        mergeSummariesInto(cliStore, e.summaries);
        break;
      }
      case 'remote_read': {
        const cid = e.clientId;
        assert.defined(cid, 'remote_read: clientId', { seq: e.seq });
        cliPoll[cid] = { results: e.results ?? [] };
        if (e.summaries) {
          const cliStore = cliS[cid];
          assert.defined(cliStore, 'remote_read: client store', { cid });
          mergeSummariesInto(cliStore, e.summaries);
        }
        break;
      }
      case 'partition': {
        const cid = e.clientId;
        assert.defined(cid, 'partition: clientId', { seq: e.seq });
        cliPart[cid] = true;
        break;
      }
      case 'heal': {
        const cid = e.clientId;
        assert.defined(cid, 'heal: clientId', { seq: e.seq });
        cliPart[cid] = false;
        break;
      }
    }
  }

  const toRows = (
    s: Record<string, { entityType: string; attrs: Record<string, boolean> }>
  ): NodeRow[] =>
    Object.keys(s)
      .sort()
      .map((id) => {
        const row = s[id];
        assert.defined(row, 'toRows: entity row', { id });
        return {
          entityId: id,
          entityType: row.entityType,
          attrs: Object.keys(row.attrs).sort(),
        };
      });

  return {
    servers: topo.servers.map((s) => {
      const rows = srvS[s.id];
      assert.defined(rows, 'replayNodeStates: server rows', {
        serverId: s.id,
      });
      return { id: s.id, rows: toRows(rows) };
    }),
    clients: topo.clients.map((c) => {
      const partitioned = cliPart[c.id];
      const cliRows = cliS[c.id];
      const lastPoll = cliPoll[c.id];
      assert.defined(partitioned, 'replayNodeStates: partition flag', {
        clientId: c.id,
      });
      assert.defined(cliRows, 'replayNodeStates: client rows', {
        clientId: c.id,
      });
      assert.ok(
        lastPoll !== undefined,
        'replayNodeStates: lastPoll slot',
        { clientId: c.id }
      );
      return {
        id: c.id,
        serverId: c.serverId,
        partitioned,
        rows: toRows(cliRows),
        lastPoll,
      };
    }),
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
    if (e.type === 'push_start') {
      assert.defined(e.clientId, 'push_start: clientId', { seq: e.seq });
      openPush[e.clientId] = true;
    }
    if (e.type === 'push_success' || e.type === 'push_fail') {
      assert.defined(e.clientId, 'push end: clientId', { seq: e.seq });
      delete openPush[e.clientId];
    }
    if (e.type === 'poll_start') {
      assert.defined(e.clientId, 'poll_start: clientId', { seq: e.seq });
      openPoll[e.clientId] = true;
    }
    if (e.type === 'poll_success' || e.type === 'poll_fail') {
      assert.defined(e.clientId, 'poll end: clientId', { seq: e.seq });
      delete openPoll[e.clientId];
    }
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
  for (const nid of nodeIds) {
    const nm = nodeMap[nid];
    assert.defined(nm, 'buildEntityDiff: node map', { nid });
    for (const eid of Object.keys(nm)) allEntityIds.add(eid);
  }

  const entities: EntityDiff[] = [];
  for (const eid of [...allEntityIds].sort()) {
    const perNode: Record<string, { type: string; attrs: Set<string> }> = {};
    let anyType = '';
    for (const nid of nodeIds) {
      const nm = nodeMap[nid];
      assert.defined(nm, 'buildEntityDiff: node map cell', { nid });
      const cell = nm[eid];
      if (cell) { perNode[nid] = cell; anyType = cell.type; }
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
      const nodesWithout = nodeIds.filter((n) => {
        const pn = perNode[n];
        return !!pn && !pn.attrs.has(attr);
      });
      const allPresent =
        nodesWith.length === presentOn.length && missingOn.length === 0;
      return { attr, allConsistent: allPresent, nodesWith, nodesWithout };
    });

    const hasDiff = entityDiffers || attrLines.some((l) => !l.allConsistent);
    entities.push({ entityId: eid, entityType: anyType, perNode, missingOn, attrLines, hasDiff });
  }
  return { entities, nodeIds, nodeLabels };
}
