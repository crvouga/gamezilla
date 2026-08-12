import type { CSSProperties } from 'react';

import type { SchemaObject } from './frame-sqlite';
import { sqlPanelStyles as s } from './sql-panel-styles';

export type SchemaInspectTarget = {
  readonly type: SchemaObject['type'];
  readonly name: string;
};

export function SchemaBrowser(props: {
  readonly objects: readonly SchemaObject[];
  readonly activeName?: string | null;
  readonly onInspect: (target: SchemaInspectTarget) => void;
}) {
  const { objects, activeName = null, onInspect } = props;
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
        activeName={activeName}
        onPick={(name) => onInspect({ type: 'table', name })}
      />
      <SchemaGroup
        title="Views"
        items={views}
        activeName={activeName}
        onPick={(name) => onInspect({ type: 'view', name })}
      />
      <SchemaGroup
        title="Indexes"
        items={indexes}
        activeName={activeName}
        onPick={(name) => onInspect({ type: 'index', name })}
      />
      {empty ? <div style={s.muted}>No user schema objects</div> : null}
    </div>
  );
}

function SchemaGroup(args: {
  readonly title: string;
  readonly items: readonly SchemaObject[];
  readonly activeName: string | null;
  readonly onPick: (name: string) => void;
}) {
  if (args.items.length === 0) return null;
  return (
    <div style={s.schemaGroup}>
      <div style={s.schemaGroupTitle}>{args.title}</div>
      {args.items.map((item) => {
        const active = item.name === args.activeName;
        return (
          <button
            key={`${item.type}:${item.name}`}
            type="button"
            title={item.sql ?? item.name}
            style={
              (active ? s.schemaItemActive : s.schemaItem) as CSSProperties
            }
            onClick={() => args.onPick(item.name)}
          >
            {item.name}
          </button>
        );
      })}
    </div>
  );
}
