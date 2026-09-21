/**
 * The fold. One implementation turns a set of {@link FeatureManifest}s into
 * the registries an app needs — production and every test harness use this
 * same function, so test wiring cannot drift from production wiring.
 *
 * The fold is total over what a feature declares and knows nothing about any
 * particular feature: `composeFeatures([PROFILE])` and
 * `composeFeatures(APP_FEATURES)` differ only in the argument.
 */

import { assert } from '@pkgs/assert';
import {
  domainsFromTables,
  registerTables,
  type Schema,
  type TableDef,
} from '@pkgs/db-schema';
import {
  defineTopicMap,
  type Mutation,
  type MutationRegistry,
  mutationRegistry,
  type QueryDef,
  type QueryRegistry,
  queryRegistry,
  type TopicMap,
  type TopicMapEntry,
} from '@pkgs/sync-engine/shared';

import type { FeatureManifest } from './manifest';

export type ComposedFeatures = {
  /** Feature names, in declaration order. */
  readonly featureNames: readonly string[];
  /** Every declared domain table, in feature declaration order. */
  readonly tables: readonly TableDef[];
  /** Sorted domain table names (the local SQLite cache set). */
  readonly tableNames: readonly string[];
  /** Registered domain ids. */
  readonly domains: readonly string[];
  /** Which feature owns a table — the boundary check's source of truth. */
  readonly ownerOfTable: ReadonlyMap<string, string>;
  readonly schema: Schema;
  readonly queries: QueryRegistry;
  /** Session-held query names, in feature order. */
  readonly sessionQueries: readonly string[];
  readonly topicMap: TopicMap;
  /** Memoized: the mutation thunks run once per composition. */
  readonly mutations: () => Promise<MutationRegistry>;
};

function collectTables(features: readonly FeatureManifest[]): {
  tables: TableDef[];
  ownerOfTable: Map<string, string>;
} {
  const tables: TableDef[] = [];
  const ownerOfTable = new Map<string, string>();
  for (const feature of features) {
    for (const table of feature.tables) {
      const owner = ownerOfTable.get(table.name);
      assert.ok(
        owner === undefined,
        `composeFeatures: table '${table.name}' is declared by both '${owner ?? ''}' and '${feature.name}' — a table belongs to exactly one feature`
      );
      ownerOfTable.set(table.name, feature.name);
      tables.push(table);
    }
  }
  return { tables, ownerOfTable };
}

function collectSessionQueries(
  features: readonly FeatureManifest[]
): readonly string[] {
  const out: string[] = [];
  for (const feature of features) {
    for (const name of feature.sessionQueries ?? []) {
      assert.ok(
        feature.queries.some((q) => q.name === name),
        `composeFeatures: feature '${feature.name}' holds session query '${name}', which it does not define`
      );
      out.push(name);
    }
  }
  return out;
}

function collectTopicMap(
  features: readonly FeatureManifest[],
  ownerOfTable: ReadonlyMap<string, string>
): TopicMap {
  const merged: Record<string, TopicMapEntry> = {};
  for (const feature of features) {
    for (const [table, entry] of Object.entries(feature.topicMap)) {
      if (entry === undefined) continue;
      assert.ok(
        ownerOfTable.get(table) === feature.name,
        `composeFeatures: feature '${feature.name}' maps topics for table '${table}', which it does not declare`
      );
      merged[table] = entry;
    }
  }
  return defineTopicMap(merged);
}

function collectQueries(features: readonly FeatureManifest[]): QueryRegistry {
  const all: QueryDef<unknown>[] = [];
  for (const feature of features) {
    all.push(...feature.queries);
  }
  return queryRegistry(all);
}

async function loadMutations(
  features: readonly FeatureManifest[]
): Promise<MutationRegistry> {
  const loaded = await Promise.all(features.map((f) => f.mutations()));
  const all: Mutation<unknown>[] = [];
  for (const group of loaded) {
    all.push(...group);
  }
  return mutationRegistry(all);
}

/**
 * Fold feature manifests into one app's registries. Duplicate table
 * declarations, and topic maps that reach past a feature's own tables, fail
 * here rather than at the first sync push.
 */
export function composeFeatures(
  features: readonly FeatureManifest[]
): ComposedFeatures {
  const names = new Set<string>();
  for (const feature of features) {
    assert.ok(
      !names.has(feature.name),
      `composeFeatures: duplicate feature '${feature.name}'`
    );
    names.add(feature.name);
  }
  const { tables, ownerOfTable } = collectTables(features);
  const schema = registerTables(tables);
  let pending: Promise<MutationRegistry> | null = null;
  return {
    featureNames: features.map((f) => f.name),
    tables,
    tableNames: Object.keys(schema.snapshot().tables).sort(),
    domains: domainsFromTables(tables),
    ownerOfTable,
    schema,
    queries: collectQueries(features),
    sessionQueries: collectSessionQueries(features),
    topicMap: collectTopicMap(features, ownerOfTable),
    mutations: () => {
      pending ??= loadMutations(features);
      return pending;
    },
  };
}
