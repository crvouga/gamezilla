import { SCHEMA_EPOCH } from '@pkgs/sync-engine-client-ts/local-schema';
import type { LocalDomainSchema } from '@pkgs/sync-engine-client-ts/local-schema-migrate';
import {
  exampleLocalSchemaExtraColumn,
  exampleLocalSchemaExtraTable,
  notesAllWithColorQuery,
  setNoteColor,
  setTag,
  tagsAllQuery,
} from './hardening-fixtures';
import type { RestartClientOpts } from './lifecycle';
import { exampleMutationRegistry, exampleQueryRegistry } from './registries';

export type ExampleSchemaVariant =
  | 'baseline'
  | 'extraColumn'
  | 'extraTable'
  | 'epochBump';

/** Registries that exercise extra-column / extra-table mutations under DST. */
export function exampleRestartOptsForVariant(
  variant: ExampleSchemaVariant
): RestartClientOpts {
  const preserve = { preserveLocalDb: true as const };
  switch (variant) {
    case 'baseline':
      return preserve;
    case 'extraColumn':
      return {
        ...preserve,
        localSchema: exampleLocalSchemaExtraColumn,
        mutationRegistry: {
          ...exampleMutationRegistry,
          [setNoteColor.name]: setNoteColor,
        },
        queryRegistry: {
          ...exampleQueryRegistry,
          [notesAllWithColorQuery.name]: notesAllWithColorQuery,
        },
        // Keep notesAll session so baseline servers still hydrate;
        // scenarios that need color SELECT use notesAllWithColor explicitly.
        sessionQuery: { name: 'notesAll', params: {} },
      };
    case 'extraTable':
      return {
        ...preserve,
        localSchema: exampleLocalSchemaExtraTable,
        mutationRegistry: {
          ...exampleMutationRegistry,
          [setTag.name]: setTag,
        },
        queryRegistry: {
          ...exampleQueryRegistry,
          [tagsAllQuery.name]: tagsAllQuery,
        },
        // Keep notesAll as session so converge still compares notes/folders;
        // tags hydrate via an explicit subscribe in scenarios that need them.
        sessionQuery: { name: 'notesAll', params: {} },
      };
    case 'epochBump':
      return { ...preserve, schemaEpoch: SCHEMA_EPOCH + 1 };
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

export function exampleSchemaForVariant(
  variant: ExampleSchemaVariant
): LocalDomainSchema | undefined {
  switch (variant) {
    case 'baseline':
    case 'epochBump':
      return undefined;
    case 'extraColumn':
      return exampleLocalSchemaExtraColumn;
    case 'extraTable':
      return exampleLocalSchemaExtraTable;
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}
