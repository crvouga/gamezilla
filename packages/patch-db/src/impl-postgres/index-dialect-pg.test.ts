import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@gamezilla/lib/keyword';
import { normalizeIndexSpec } from '../indexes/index-spec';
import {
  postgresDdlCreate,
  postgresDdlDrop,
  postgresIndexDialect,
} from './index-dialect-pg';

describe('postgresDdlCreate', () => {
  test('attribute column with implicit entity-type filter', () => {
    const spec = normalizeIndexSpec({
      name: 'space-host',
      entityType: 'space',
      fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
    });
    const ddl = postgresDdlCreate(spec);
    expect(ddl).toContain(`CREATE INDEX IF NOT EXISTS "${spec.dbName}"`);
    expect(ddl).toContain(' ON snapshots ');
    expect(ddl).toContain(`(attributes->>'space/host-id')`);
    expect(ddl).toContain(` WHERE entity_type = 'space'`);
    expect(ddl).not.toContain(` AND `);
  });

  test('multi-column entityType + entityId with attribute-absent partial WHERE', () => {
    const spec = normalizeIndexSpec({
      name: 'space-live',
      entityType: 'space',
      fields: [{ kind: 'entityType' }, { kind: 'entityId' }],
      where: [
        { kind: 'attributeAbsent', attribute: asKeyword('space/ended-at') },
      ],
    });
    const ddl = postgresDdlCreate(spec);
    expect(ddl).toContain('(entity_type, entity_id)');
    expect(ddl).toContain(`entity_type = 'space'`);
    expect(ddl).toContain(`AND NOT (attributes ? 'space/ended-at')`);
  });

  test('attribute-exists WHERE clause', () => {
    const spec = normalizeIndexSpec({
      name: 'mship-mat',
      entityType: 'space.membership',
      fields: [{ kind: 'entityId' }],
      where: [
        {
          kind: 'attributeExists',
          attribute: asKeyword('space.membership/guest-id'),
        },
      ],
    });
    const ddl = postgresDdlCreate(spec);
    expect(ddl).toContain(`AND (attributes ? 'space.membership/guest-id')`);
    expect(ddl).toContain(`entity_type = 'space.membership'`);
  });

  test('emits identifier-quoted index name', () => {
    const spec = normalizeIndexSpec({
      name: 'x',
      entityType: 'space',
      fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
    });
    const ddl = postgresDdlCreate(spec);
    expect(ddl).toContain(`"${spec.dbName}"`);
  });
});

describe('postgresDdlDrop', () => {
  test('idempotent DROP INDEX IF EXISTS', () => {
    expect(postgresDdlDrop('pdb_idx_x__y__abc12345')).toBe(
      `DROP INDEX IF EXISTS "pdb_idx_x__y__abc12345"`
    );
  });
});

describe('postgresIndexDialect', () => {
  test('exposes introspect/ddlCreate/ddlDrop', () => {
    expect(typeof postgresIndexDialect.introspect).toBe('function');
    expect(typeof postgresIndexDialect.ddlCreate).toBe('function');
    expect(typeof postgresIndexDialect.ddlDrop).toBe('function');
  });
});
