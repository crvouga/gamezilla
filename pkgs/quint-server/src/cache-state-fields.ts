import type { Loc, QuintOpDef } from '@informalsystems/quint';
import { cacheRecordFields, type SourceEdit } from './cache-record-fields';

/** Share pre-state projections across every operator of their declaring module. */
export function cacheStateFields(input: {
  readonly definitions: readonly QuintOpDef[];
  readonly insertion: number;
  readonly variables: readonly string[];
  readonly source: string;
  readonly sourceMap: ReadonlyMap<bigint, Loc>;
  readonly edits: SourceEdit[];
  readonly freshName: () => string;
}): void {
  const body = {
    kind: 'app' as const,
    id: -1n,
    opcode: 'and',
    args: input.definitions.map((definition) => definition.expr),
  };
  const bindings = input.variables.flatMap((variable) =>
    cacheRecordFields({
      body,
      parameter: variable,
      source: input.source,
      sourceMap: input.sourceMap,
      edits: input.edits,
      qualifier: 'val',
      freshName: input.freshName,
    })
  );
  if (bindings.length === 0) return;
  input.edits.push({
    start: input.insertion,
    end: input.insertion,
    text: `\n${bindings.join('\n')}\n`,
  });
}
