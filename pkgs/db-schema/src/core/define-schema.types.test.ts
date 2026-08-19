/**
 * Type-level enforcement tests. Failures must be `@ts-expect-error`.
 * These files are included in `tsc --noEmit`.
 */
import { defineTable } from './define-table';
import type { ServerOperation } from './operations';
import { registerTables } from './register-tables';

// Legal schema compiles
const _ok = registerTables([
  defineTable({
    domain: 'users',
    name: 'users',
    columns: { email: 'text' },
    deprecations: [['display_name', 'use email']],
  }),
  defineTable({
    domain: 'todos',
    name: 'todos',
    columns: {
      user_id: 'uuid',
      title: 'text',
      done: 'boolean',
    },
    indexes: ['user_id'],
  }),
]);
void _ok;

// ServerOperation kinds must be additive-only
type ServerKinds = ServerOperation['kind'];
type AssertAdditive = ServerKinds extends
  | 'create_table'
  | 'add_column'
  | 'create_index'
  | 'drop_index'
  ? true
  : false;
const _additive: AssertAdditive = true;
void _additive;

type HasDropTable = 'drop_table' extends ServerKinds ? true : false;
const _noDropTable: HasDropTable = false;
void _noDropTable;

type HasDropColumn = 'drop_column' extends ServerKinds ? true : false;
const _noDropColumn: HasDropColumn = false;
void _noDropColumn;

type HasRebuild = 'rebuild_table' extends ServerKinds ? true : false;
const _noRebuild: HasRebuild = false;
void _noRebuild;
