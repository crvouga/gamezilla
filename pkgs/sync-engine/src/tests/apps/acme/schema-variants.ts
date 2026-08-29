import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';

import type { LocalDomainSchema } from '../../../client/local-schema-migrate';
import type { RestartClientOpts } from '../../../sim/world-lifecycle';
import {
  acmeLocalSchemaExtraColumn,
  acmeLocalSchemaExtraTable,
  notesWorldWithColorQuery,
  setNoteColor,
  setTag,
  tagsWorldQuery,
} from './shared/hardening-fixtures';
import { acmeMutationRegistry, acmeQueryRegistry } from './shared/registries';

export type AcmeSchemaVariant =
  | 'baseline'
  | 'extraColumn'
  | 'extraTable'
  | 'epochBump';

/** Registries that exercise extra-column / extra-table mutations under DST. */
export function acmeRestartOptsForVariant(
  variant: AcmeSchemaVariant
): RestartClientOpts {
  const preserve = { preserveLocalDb: true as const };
  switch (variant) {
    case 'baseline':
      return preserve;
    case 'extraColumn':
      return {
        ...preserve,
        localSchema: acmeLocalSchemaExtraColumn,
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setNoteColor.name]: setNoteColor,
        },
        queryRegistry: {
          ...acmeQueryRegistry,
          [notesWorldWithColorQuery.name]: notesWorldWithColorQuery,
        },
        // Keep notesWorld session so baseline servers still hydrate;
        // scenarios that need color SELECT use notesWorldWithColor explicitly.
        sessionQuery: { name: 'notesWorld', params: {} },
      };
    case 'extraTable':
      return {
        ...preserve,
        localSchema: acmeLocalSchemaExtraTable,
        mutationRegistry: {
          ...acmeMutationRegistry,
          [setTag.name]: setTag,
        },
        queryRegistry: {
          ...acmeQueryRegistry,
          [tagsWorldQuery.name]: tagsWorldQuery,
        },
        // Keep notesWorld as session so converge still compares notes/folders;
        // tags hydrate via an explicit subscribe in scenarios that need them.
        sessionQuery: { name: 'notesWorld', params: {} },
      };
    case 'epochBump':
      return { ...preserve, schemaEpoch: SCHEMA_EPOCH + 1 };
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

export function acmeSchemaForVariant(
  variant: AcmeSchemaVariant
): LocalDomainSchema | undefined {
  switch (variant) {
    case 'baseline':
    case 'epochBump':
      return undefined;
    case 'extraColumn':
      return acmeLocalSchemaExtraColumn;
    case 'extraTable':
      return acmeLocalSchemaExtraTable;
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}
