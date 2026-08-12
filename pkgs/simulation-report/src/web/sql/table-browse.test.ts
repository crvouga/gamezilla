import { describe, expect, test } from 'bun:test';

import {
  buildTableCountSql,
  buildTablePageSql,
  pageCount,
  pageRangeLabel,
  quoteIdent,
} from './table-browse';

describe('quoteIdent', () => {
  test('quotes and escapes embedded quotes', () => {
    expect(quoteIdent('client_config')).toBe('"client_config"');
    expect(quoteIdent('weird"name')).toBe('"weird""name"');
  });
});

describe('buildTablePageSql', () => {
  test('builds LIMIT/OFFSET from page', () => {
    expect(buildTablePageSql({ name: 't', page: 0, pageSize: 100 })).toBe(
      'SELECT * FROM "t" LIMIT 100 OFFSET 0;'
    );
    expect(buildTablePageSql({ name: 't', page: 2, pageSize: 50 })).toBe(
      'SELECT * FROM "t" LIMIT 50 OFFSET 100;'
    );
  });
});

describe('buildTableCountSql', () => {
  test('counts quoted table', () => {
    expect(buildTableCountSql('t')).toBe('SELECT COUNT(*) AS n FROM "t";');
  });
});

describe('pageCount / pageRangeLabel', () => {
  test('pageCount', () => {
    expect(pageCount(0, 100)).toBe(1);
    expect(pageCount(100, 100)).toBe(1);
    expect(pageCount(101, 100)).toBe(2);
  });
  test('pageRangeLabel', () => {
    expect(
      pageRangeLabel({ page: 0, pageSize: 100, totalRows: 1234, rowCount: 100 })
    ).toBe('1–100 of 1234');
    expect(
      pageRangeLabel({ page: 12, pageSize: 100, totalRows: 1234, rowCount: 34 })
    ).toBe('1201–1234 of 1234');
    expect(
      pageRangeLabel({ page: 0, pageSize: 100, totalRows: 0, rowCount: 0 })
    ).toBe('0 rows');
  });
});
