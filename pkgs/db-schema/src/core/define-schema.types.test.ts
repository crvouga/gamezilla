/**
 * Type-level enforcement tests. Failures must be `@ts-expect-error`.
 * These files are included in `tsc --noEmit`.
 */
import { defineSchema } from './define-schema';
import type { ServerOperation } from './operations';
import type { SchemaInput } from './validate-schema-types';

// Legal schema compiles
const _ok = defineSchema({
  tables: {
    users: {
      email: 'text',
      display_name: 'text',
    },
    todos: {
      user_id: 'uuid',
      title: 'text',
      done: 'boolean',
    },
  },
  indexes: [['todos', 'user_id']],
  deprecations: [['users', 'display_name', 'use email']],
});
void _ok;

type ExpectError<T> =
  SchemaInput<T> extends { readonly __error: string } ? true : false;

const _pascal: ExpectError<{ tables: { Users: { email: 'text' } } }> = true;
const _camel: ExpectError<{ tables: { users: { userId: 'text' } } }> = true;
const _kebab: ExpectError<{
  tables: { users: { 'user-id': 'text' } };
}> = true;
const _underscore: ExpectError<{ tables: { users: { _id: 'text' } } }> = true;
const _typo: ExpectError<{ tables: { users: { email: 'txet' } } }> = true;
const _objectCol: ExpectError<{
  tables: { users: { email: { type: 'text' } } };
}> = true;
const _badIndexTable: ExpectError<{
  tables: { users: { email: 'text' } };
  indexes: [['nope', 'email']];
}> = true;
const _badIndexCol: ExpectError<{
  tables: { users: { email: 'text' } };
  indexes: [['users', 'nope']];
}> = true;
const _badDepTable: ExpectError<{
  tables: { users: { email: 'text' } };
  deprecations: [['nope', 'gone']];
}> = true;
const _badDepCol: ExpectError<{
  tables: { users: { email: 'text' } };
  deprecations: [['users', 'nope', 'gone']];
}> = true;

void _pascal;
void _camel;
void _kebab;
void _underscore;
void _typo;
void _objectCol;
void _badIndexTable;
void _badIndexCol;
void _badDepTable;
void _badDepCol;

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
