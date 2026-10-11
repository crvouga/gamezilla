/**
 * The fold. One implementation turns a tree of {@link SubManifest}s into
 * the registries an app needs — production and every test harness use this
 * same function, so test wiring cannot drift from production wiring.
 *
 * Walk order is pre-order: a node, then the subs it contains. A flat list is
 * a depth-1 tree. The fold knows nothing about any particular sub:
 * `composeSubs([PROFILE])` and `composeSubs(APP_SUBS)` differ only in the
 * argument.
 */

import { assert } from '@pkgs/assert-root-shared/singleton';
import type { TableDef } from '@pkgs/db-schema-root-shared/define-table';
import {
  domainsFromTables,
  registerTables,
} from '@pkgs/db-schema-root-shared/register-tables';
import type { Schema } from '@pkgs/db-schema-root-shared/types';
import { mutationRegistry } from '@pkgs/sync-engine-shared/mutations-registry';
import type {
  Mutation,
  MutationAuthorize,
  MutationRegistry,
} from '@pkgs/sync-engine-shared/mutations-types';
import { queryRegistry } from '@pkgs/sync-engine-shared/queries-registry';
import type {
  QueryDef,
  QueryRegistry,
} from '@pkgs/sync-engine-shared/queries-types';
import type {
  TopicMap,
  TopicMapEntry,
} from '@pkgs/sync-engine-shared/topic-map';
import { defineTopicMap } from '@pkgs/sync-engine-shared/topic-map';
import type { AccountPrivacyContribution } from './account-privacy';
import { flattenSubs } from './flatten';
import type { SubManifest } from './manifest';

export type ComposedSubs = {
  /** Sub names, in walk order. */
  readonly subNames: readonly string[];
  /** Every declared domain table, in walk order. */
  readonly tables: readonly TableDef[];
  /** Sorted domain table names (the local SQLite cache set). */
  readonly tableNames: readonly string[];
  /** Registered domain ids. */
  readonly domains: readonly string[];
  /** Which sub owns a table — the boundary check's source of truth. */
  readonly ownerOfTable: ReadonlyMap<string, string>;
  readonly schema: Schema;
  readonly queries: QueryRegistry;
  /** Session-held query names, in walk order. */
  readonly sessionQueries: readonly string[];
  readonly topicMap: TopicMap;
  /** Memoized: the mutation thunks run once per composition. */
  readonly mutations: () => Promise<MutationRegistry>;
  readonly accountPrivacy: readonly AccountPrivacyContribution[];
  readonly authorizeMutation: MutationAuthorize;
};

function collectTables(subs: readonly SubManifest[]): {
  tables: TableDef[];
  ownerOfTable: Map<string, string>;
} {
  const tables: TableDef[] = [];
  const ownerOfTable = new Map<string, string>();
  for (const sub of subs) {
    for (const table of sub.tables) {
      const owner = ownerOfTable.get(table.name);
      assert.ok(
        owner === undefined,
        `composeSubs: table '${table.name}' is declared by both '${owner ?? ''}' and '${sub.name}' — a table belongs to exactly one sub`
      );
      ownerOfTable.set(table.name, sub.name);
      tables.push(table);
    }
  }
  return { tables, ownerOfTable };
}

function collectSessionQueries(
  subs: readonly SubManifest[]
): readonly string[] {
  const out: string[] = [];
  for (const sub of subs) {
    for (const name of sub.sessionQueries ?? []) {
      assert.ok(
        sub.queries.some((q) => q.name === name),
        `composeSubs: sub '${sub.name}' holds session query '${name}', which it does not define`
      );
      out.push(name);
    }
  }
  return out;
}

function collectTopicMap(
  subs: readonly SubManifest[],
  ownerOfTable: ReadonlyMap<string, string>
): TopicMap {
  const merged: Record<string, TopicMapEntry> = {};
  for (const sub of subs) {
    for (const [table, entry] of Object.entries(sub.topicMap)) {
      if (entry === undefined) continue;
      assert.ok(
        ownerOfTable.get(table) === sub.name,
        `composeSubs: sub '${sub.name}' maps topics for table '${table}', which it does not declare`
      );
      merged[table] = entry;
    }
  }
  return defineTopicMap(merged);
}

function collectQueries(subs: readonly SubManifest[]): QueryRegistry {
  const all: QueryDef<unknown>[] = [];
  for (const sub of subs) {
    all.push(...sub.queries);
  }
  return queryRegistry(all);
}

async function loadMutations(
  subs: readonly SubManifest[]
): Promise<MutationRegistry> {
  const loaded = await Promise.all(subs.map((sub) => sub.mutations()));
  const all: Mutation<unknown>[] = [];
  for (const group of loaded) {
    all.push(...group);
  }
  return mutationRegistry(all);
}

/**
 * Fold sub manifests into one app's registries. A repeated name, a repeated
 * table, a walk that re-enters a node, and a topic map that reaches past a
 * sub's own tables fail here rather than at the first sync push.
 */
export function composeSubs(roots: readonly SubManifest[]): ComposedSubs {
  const subs = flattenSubs(roots, 'composeSubs');
  const { tables, ownerOfTable } = collectTables(subs);
  const schema = registerTables(tables);
  let pending: Promise<MutationRegistry> | null = null;
  const accountPrivacy = subs.flatMap((sub) =>
    sub.accountPrivacy === undefined ? [] : [sub.accountPrivacy]
  );
  const guards = subs.flatMap((sub) =>
    sub.accountPrivacyGuard === undefined
      ? []
      : [sub.accountPrivacyGuard(accountPrivacy)]
  );
  return {
    subNames: subs.map((sub) => sub.name),
    accountPrivacy,
    authorizeMutation: async (ctx) => {
      for (const guard of guards) await guard(ctx);
    },
    tables,
    tableNames: Object.keys(schema.snapshot().tables).sort(),
    domains: domainsFromTables(tables),
    ownerOfTable,
    schema,
    queries: collectQueries(subs),
    sessionQueries: collectSessionQueries(subs),
    topicMap: collectTopicMap(subs, ownerOfTable),
    mutations: () => {
      pending ??= loadMutations(subs);
      return pending;
    },
  };
}
