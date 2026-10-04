export type SqlNotebookCell = {
  readonly id: string;
  readonly sql: string;
  readonly live: boolean;
};

export type SqlNotebookDoc = {
  readonly version: 1;
  readonly nodeId: string;
  readonly cells: readonly SqlNotebookCell[];
};

export function createEmptyNotebook(args: {
  readonly nodeId: string;
  readonly cellId: string;
  readonly starterSql: string;
}): SqlNotebookDoc {
  return {
    version: 1,
    nodeId: args.nodeId,
    cells: [{ id: args.cellId, sql: args.starterSql, live: false }],
  };
}

export function setCellSql(
  doc: SqlNotebookDoc,
  cellId: string,
  sql: string
): SqlNotebookDoc {
  return mapCell(doc, cellId, (c) => ({ ...c, sql }));
}

export function toggleLive(
  doc: SqlNotebookDoc,
  cellId: string
): SqlNotebookDoc {
  return mapCell(doc, cellId, (c) => ({ ...c, live: !c.live }));
}

export function addCellAfter(args: {
  readonly doc: SqlNotebookDoc;
  readonly afterId: string | null;
  readonly cell: SqlNotebookCell;
}): SqlNotebookDoc {
  const { doc, afterId, cell } = args;
  if (afterId === null) {
    return { ...doc, cells: [...doc.cells, cell] };
  }
  const idx = doc.cells.findIndex((c) => c.id === afterId);
  if (idx < 0) return { ...doc, cells: [...doc.cells, cell] };
  const cells = [
    ...doc.cells.slice(0, idx + 1),
    cell,
    ...doc.cells.slice(idx + 1),
  ];
  return { ...doc, cells };
}

export function removeCell(
  doc: SqlNotebookDoc,
  cellId: string
): SqlNotebookDoc {
  if (doc.cells.length <= 1) return doc;
  return { ...doc, cells: doc.cells.filter((c) => c.id !== cellId) };
}

export function moveCell(
  doc: SqlNotebookDoc,
  cellId: string,
  dir: -1 | 1
): SqlNotebookDoc {
  const idx = doc.cells.findIndex((c) => c.id === cellId);
  if (idx < 0) return doc;
  const next = idx + dir;
  if (next < 0 || next >= doc.cells.length) return doc;
  const cells = [...doc.cells];
  const tmp = cells[idx]!;
  cells[idx] = cells[next]!;
  cells[next] = tmp;
  return { ...doc, cells };
}

export function duplicateCell(args: {
  readonly doc: SqlNotebookDoc;
  readonly cellId: string;
  readonly newId: string;
}): SqlNotebookDoc {
  const src = args.doc.cells.find((c) => c.id === args.cellId);
  if (src === undefined) return args.doc;
  return addCellAfter({
    doc: args.doc,
    afterId: args.cellId,
    cell: { id: args.newId, sql: src.sql, live: false },
  });
}

export function encodeNotebookDoc(doc: SqlNotebookDoc): string {
  return JSON.stringify(doc);
}

export function decodeNotebookDoc(
  raw: string,
  expectedNodeId: string
): SqlNotebookDoc | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed['version'] !== 1) return null;
  if (parsed['nodeId'] !== expectedNodeId) return null;
  if (!Array.isArray(parsed['cells'])) return null;
  const cells: SqlNotebookCell[] = [];
  for (const item of parsed['cells']) {
    const cell = decodeCell(item);
    if (cell === null) return null;
    cells.push(cell);
  }
  if (cells.length === 0) return null;
  return { version: 1, nodeId: expectedNodeId, cells };
}

function decodeCell(item: unknown): SqlNotebookCell | null {
  if (!isRecord(item)) return null;
  if (typeof item['id'] !== 'string' || item['id'].length === 0) return null;
  if (typeof item['sql'] !== 'string') return null;
  if (typeof item['live'] !== 'boolean') return null;
  return { id: item['id'], sql: item['sql'], live: item['live'] };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mapCell(
  doc: SqlNotebookDoc,
  cellId: string,
  fn: (cell: SqlNotebookCell) => SqlNotebookCell
): SqlNotebookDoc {
  return {
    ...doc,
    cells: doc.cells.map((c) => (c.id === cellId ? fn(c) : c)),
  };
}
