import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { printSqlCliResult } from './print-result';

describe('printSqlCliResult', () => {
  afterEach(() => {
    mock.restore();
  });

  it('prints query rows as a table', () => {
    const table = spyOn(console, 'table').mockImplementation(() => {});
    const rows = [{ id: 1, name: 'Ada' }];

    printSqlCliResult({ kind: 'rows', rows });

    expect(table).toHaveBeenCalledWith(rows);
  });

  it('prints run metadata as a single table row', () => {
    const table = spyOn(console, 'table').mockImplementation(() => {});

    printSqlCliResult({
      kind: 'run',
      result: { changes: 2, lastInsertRowid: 7 },
    });

    expect(table).toHaveBeenCalledWith([
      { changes: 2, lastInsertRowid: 7 },
    ]);
  });

  it('prints messages directly', () => {
    const log = spyOn(console, 'log').mockImplementation(() => {});

    printSqlCliResult({ kind: 'message', message: 'Ready' });

    expect(log).toHaveBeenCalledWith('Ready');
  });

  it('describes empty results', () => {
    const log = spyOn(console, 'log').mockImplementation(() => {});

    printSqlCliResult({ kind: 'empty' });

    expect(log).toHaveBeenCalledWith('No rows returned');
  });
});
