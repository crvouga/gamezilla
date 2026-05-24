/**
 * Shared query-builder options type. Lives in its own file so
 * {@link ./query-builder-pg-snapshot} and {@link ./query-builder-pg-where}
 * can both depend on it without a circular import through the facade.
 */
import type { FrozenEntitySchemaRegistry } from '../schema/entity-schema-registry';
import type { FrozenPartitionLayout } from './partitioning';

export type PgQueryBuilderOptions = {
  readonly schemaRegistry?: FrozenEntitySchemaRegistry;
  readonly explainGuard?: { readonly mode: 'off' | 'warn' | 'crash' };
  readonly partitions?: FrozenPartitionLayout;
};
