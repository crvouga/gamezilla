import { expect, test } from 'bun:test';
import { MIGRATIONS } from './sql-constants';

test('postgres migrations: entity-scoped indexes and snapshots PK order', () => {
  expect(MIGRATIONS).toContain('idx_patches_entity');
  expect(MIGRATIONS).toContain('idx_patches_roots');
  expect(MIGRATIONS).toContain('idx_patches_parent');
  expect(MIGRATIONS).toContain('idx_snapshots_attrs_gin');
  expect(MIGRATIONS).toContain('PRIMARY KEY (entity_type, entity_id)');
  expect(MIGRATIONS).not.toContain('REFERENCES patches');
});

test('postgres migrations: application-agnostic (no domain entity types)', () => {
  // The library must not reference any application-specific entity types or
  // attribute keys. Apps own their own snapshot expression indexes via their
  // own migrations on top of the patch-db base schema.
  expect(MIGRATIONS).not.toMatch(/entity_type\s*=\s*'/i);
  expect(MIGRATIONS).not.toContain("attributes->>'");
  expect(MIGRATIONS).not.toContain('attributes ?');
});
