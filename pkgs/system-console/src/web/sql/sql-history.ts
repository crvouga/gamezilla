/** Session query history keyed by SQLite node id. */

export type SqlHistoryEntry = {
  readonly sql: string;
  readonly atMs: number;
};

const MAX_PER_NODE = 40;

const byNode = new Map<string, SqlHistoryEntry[]>();

export function pushSqlHistory(
  nodeId: string,
  sql: string,
  atMs: number
): void {
  const trimmed = sql.trim();
  if (trimmed.length === 0) return;
  const list = byNode.get(nodeId) ?? [];
  const next = [
    { sql: trimmed, atMs },
    ...list.filter((e) => e.sql !== trimmed),
  ];
  byNode.set(nodeId, next.slice(0, MAX_PER_NODE));
}

export function listSqlHistory(nodeId: string): readonly SqlHistoryEntry[] {
  return byNode.get(nodeId) ?? [];
}

export function clearSqlHistory(nodeId?: string): void {
  if (nodeId === undefined) {
    byNode.clear();
    return;
  }
  byNode.delete(nodeId);
}
