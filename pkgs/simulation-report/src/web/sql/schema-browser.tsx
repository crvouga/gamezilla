import type { CSSProperties } from 'react';

import type { SchemaObject } from './frame-sqlite';
import { sqlPanelStyles as s } from './sql-panel-styles';

export function SchemaBrowser(props: {
  readonly objects: readonly SchemaObject[];
  readonly onInsertSql: (sql: string) => void;
}) {
  const { objects, onInsertSql } = props;
  const tables = objects.filter((o) => o.type === 'table');
  const views = objects.filter((o) => o.type === 'view');
  const indexes = objects.filter((o) => o.type === 'index');
  const empty =
    tables.length === 0 && views.length === 0 && indexes.length === 0;
  return (
    <div style={s.schemaRoot}>
      <SchemaGroup
        title="Tables"
        items={tables}
        onPick={(name) => onInsertSql(`SELECT * FROM "${name}" LIMIT 100;`)}
      />
      <SchemaGroup
        title="Views"
        items={views}
        onPick={(name) => onInsertSql(`SELECT * FROM "${name}" LIMIT 100;`)}
      />
      <SchemaGroup
        title="Indexes"
        items={indexes}
        onPick={(name) =>
          onInsertSql(
            `SELECT * FROM sqlite_master WHERE type='index' AND name='${name}';`
          )
        }
      />
      {empty ? <div style={s.muted}>No user schema objects</div> : null}
    </div>
  );
}

function SchemaGroup(args: {
  readonly title: string;
  readonly items: readonly SchemaObject[];
  readonly onPick: (name: string) => void;
}) {
  if (args.items.length === 0) return null;
  return (
    <div style={s.schemaGroup}>
      <div style={s.schemaGroupTitle}>{args.title}</div>
      {args.items.map((item) => (
        <button
          key={`${item.type}:${item.name}`}
          type="button"
          title={item.sql ?? item.name}
          style={s.schemaItem as CSSProperties}
          onClick={() => args.onPick(item.name)}
        >
          {item.name}
        </button>
      ))}
    </div>
  );
}
