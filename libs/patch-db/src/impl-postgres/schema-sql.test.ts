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

test('postgres migrations: hot snapshot expression indexes (client list queries)', () => {
  expect(MIGRATIONS).toContain('idx_snap_space_host');
  expect(MIGRATIONS).toContain('idx_snap_space_live');
  expect(MIGRATIONS).toContain('idx_snap_membership_guest');
  expect(MIGRATIONS).toContain('idx_snap_membership_space');
  expect(MIGRATIONS).toContain('idx_snap_membership_active');
  expect(MIGRATIONS).toContain('idx_snap_session_device');
  expect(MIGRATIONS).toContain('idx_snap_session_account');
  expect(MIGRATIONS).toContain('idx_snap_provider_account');
});
