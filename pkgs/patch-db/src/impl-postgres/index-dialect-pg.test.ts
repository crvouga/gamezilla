import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
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
    // Text path: matches `(attributes::jsonb ->> 'k')` from query builder.
    expect(ddl).toContain(`(attributes::jsonb ->> 'space/host-id')`);
    expect(ddl).not.toContain(`::numeric`);
    expect(ddl).toContain(` WHERE entity_type = 'space'`);
    expect(ddl).not.toContain(` AND `);
  });

  test('numeric attribute emits ::numeric cast matching the query builder', () => {
    // chess.puzzle/rating is `dataType: integer`; query builder does
    // `((attributes::jsonb ->> 'k')::numeric) > ?::numeric` for `gt` etc.
    // Without the same cast in the index expression, the planner ignores
    // it (this was the original Phase 0 perf regression).
    const spec = normalizeIndexSpec({
      name: 'puzzle-rating',
      entityType: 'chess.puzzle',
      fields: [
        {
          kind: 'attribute',
          attribute: asKeyword('chess.puzzle/rating'),
          dataType: 'integer',
        },
      ],
    });
    const ddl = postgresDdlCreate(spec);
    expect(ddl).toContain(
      `((attributes::jsonb ->> 'chess.puzzle/rating')::numeric)`
    );
    expect(ddl).toContain(`WHERE entity_type = 'chess.puzzle'`);
  });

  test('number / bigint attributes also get ::numeric cast', () => {
    for (const dt of ['number', 'bigint'] as const) {
      const spec = normalizeIndexSpec({
        name: 'amount',
        entityType: 'demo',
        fields: [
          {
            kind: 'attribute',
            attribute: asKeyword('demo/amount'),
            dataType: dt,
          },
        ],
      });
      const ddl = postgresDdlCreate(spec);
      expect(ddl).toContain(`((attributes::jsonb ->> 'demo/amount')::numeric)`);
    }
  });

  test('text-shaped attributes (text/uuid/enum/email/url/date/...) stay text', () => {
    for (const dt of [
      'text',
      'uuid',
      'enum',
      'email',
      'url',
      'date',
      'timestamp',
      'boolean',
    ] as const) {
      const spec = normalizeIndexSpec({
        name: 'label',
        entityType: 'demo',
        fields: [
          {
            kind: 'attribute',
            attribute: asKeyword('demo/label'),
            dataType: dt,
          },
        ],
      });
      const ddl = postgresDdlCreate(spec);
      expect(ddl).toContain(`(attributes::jsonb ->> 'demo/label')`);
      expect(ddl).not.toContain(`::numeric`);
    }
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
