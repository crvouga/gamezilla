import { describe, expect, test } from 'bun:test';

import {
  addCellAfter,
  createEmptyNotebook,
  decodeNotebookDoc,
  encodeNotebookDoc,
  moveCell,
  removeCell,
  setCellSql,
  toggleLive,
} from '@pkgs/harness-console-client/notebook-doc';

describe('notebook-doc', () => {
  test('create encode decode roundtrip', () => {
    const doc = createEmptyNotebook({
      nodeId: 'alice',
      cellId: 'c1',
      starterSql: 'SELECT 1;',
    });
    const raw = encodeNotebookDoc(doc);
    expect(decodeNotebookDoc(raw, 'alice')).toEqual(doc);
    expect(decodeNotebookDoc(raw, 'bob')).toBeNull();
  });

  test('cell mutators', () => {
    let doc = createEmptyNotebook({
      nodeId: 'server',
      cellId: 'a',
      starterSql: 'A',
    });
    doc = addCellAfter({
      doc,
      afterId: 'a',
      cell: { id: 'b', sql: 'B', live: false },
    });
    expect(doc.cells.map((c) => c.id)).toEqual(['a', 'b']);
    doc = setCellSql(doc, 'b', 'BB');
    expect(doc.cells[1]?.sql).toBe('BB');
    doc = toggleLive(doc, 'b');
    expect(doc.cells[1]?.live).toBe(true);
    doc = moveCell(doc, 'b', -1);
    expect(doc.cells.map((c) => c.id)).toEqual(['b', 'a']);
    doc = removeCell(doc, 'a');
    expect(doc.cells.map((c) => c.id)).toEqual(['b']);
    expect(removeCell(doc, 'b')).toEqual(doc);
  });

  test('rejects bad payload', () => {
    expect(decodeNotebookDoc('{', 'x')).toBeNull();
    expect(
      decodeNotebookDoc('{"version":2,"nodeId":"x","cells":[]}', 'x')
    ).toBeNull();
  });
});
