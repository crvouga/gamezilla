import { assert } from '@pkgs/assert-root-shared-ts/singleton';

export type AstNode = Record<string, unknown>;

export function asNode(value: unknown): AstNode | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as AstNode;
  }
  return undefined;
}

export function identifierValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value.toLowerCase();
  const node = asNode(value);
  if (node === undefined) return undefined;
  const expr = asNode(node['expr']);
  if (typeof expr?.['value'] === 'string') return expr['value'].toLowerCase();
  if (typeof node['value'] === 'string') return node['value'].toLowerCase();
  return undefined;
}

export type Relation = {
  readonly table: string;
  readonly qualifier: string;
  readonly on: unknown;
};

export function fromRelations(from: unknown): Relation[] {
  if (!Array.isArray(from)) return [];
  const relations: Relation[] = [];
  for (const item of from) {
    const node = asNode(item);
    const table = identifierValue(node?.['table']);
    if (table === undefined) continue;
    relations.push({
      table,
      qualifier: identifierValue(node?.['as']) ?? table,
      on: node?.['on'],
    });
  }
  return relations;
}

export type ColumnScope = {
  readonly relation: Relation;
  readonly relations: readonly Relation[];
};

/** Resolve columns in this SELECT only; outer aliases belong to outer paths. */
export function scopedColumn(
  expr: unknown,
  scope: ColumnScope
): string | undefined {
  const node = asNode(expr);
  if (node?.['type'] !== 'column_ref') return undefined;
  const name = identifierValue(node['column']);
  if (name === undefined) return undefined;
  const qualifier = identifierValue(node['table']);
  if (qualifier !== undefined) {
    return qualifier === scope.relation.qualifier ? name : undefined;
  }
  // A bare wildcard is safe on each table; other bare columns are ambiguous.
  assert.ok(
    name === '*' || scope.relations.length === 1,
    `ambiguous unqualified column: ${name}`
  );
  return name;
}
