import { describe, expect, test } from 'bun:test';
import {
  CLIENT_EXTRA_OPERATION_KINDS,
  SERVER_OPERATION_KINDS,
} from './core/operations';
import * as root from './index';

describe('db-schema surface coverage', () => {
  test('root exports include define + register surface', () => {
    expect(typeof root.defineTable).toBe('function');
    expect(typeof root.defineView).toBe('function');
    expect(typeof root.defineEnum).toBe('function');
    expect(typeof root.registerTables).toBe('function');
    expect(typeof root.registerSchema).toBe('function');
    expect(typeof root.domainsFromTables).toBe('function');
    expect(root.POSTGRES_CAPS.refuseDestructiveDdl).toBe(true);
    expect(root.SQLITE_CAPS.dropDeprecated).toBe(true);
  });

  test('operation kind lists are exhaustive compile-checked sets', () => {
    expect(SERVER_OPERATION_KINDS).toContain('backfill');
    expect(SERVER_OPERATION_KINDS).toContain('create_view');
    expect(SERVER_OPERATION_KINDS).toContain('add_enum_value');
    expect(CLIENT_EXTRA_OPERATION_KINDS).toContain('rebuild_table');
    expect(CLIENT_EXTRA_OPERATION_KINDS).toContain('drop_view');
  });
});
