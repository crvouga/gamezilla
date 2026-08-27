import { SCHEMA_EPOCH } from '@pkgs/sync-engine/test';

import type { LocalDomainSchema } from '../../../client/local-schema-migrate';
import type { RestartClientOpts } from '../../../sim/world-lifecycle';
import {
  acmeLocalSchemaExtraColumn,
  acmeLocalSchemaExtraTable,
} from './shared/hardening-fixtures';

export type AcmeSchemaVariant =
  | 'baseline'
  | 'extraColumn'
  | 'extraTable'
  | 'epochBump';

export function acmeRestartOptsForVariant(
  variant: AcmeSchemaVariant
): RestartClientOpts {
  const preserve = { preserveLocalDb: true as const };
  switch (variant) {
    case 'baseline':
      return preserve;
    case 'extraColumn':
      return { ...preserve, localSchema: acmeLocalSchemaExtraColumn };
    case 'extraTable':
      return { ...preserve, localSchema: acmeLocalSchemaExtraTable };
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
