/**
 * A feature manifest is the one thing a bounded context exports about itself.
 * It names the slice of every layer the feature owns — domain tables, synced
 * reads, writes — so the composition root can fold a set of features into an
 * app without knowing what any of them is.
 *
 * Features never import each other, and nothing here imports a feature: the
 * fold is generic over what features declare. Cross-feature needs are ports
 * the feature declares from its own point of view and the composition root
 * fills in.
 */

import type { TableDef } from '@pkgs/db-schema-shared/define-table';
import type { Mutation } from '@pkgs/sync-engine-shared/mutations-types';
import type { QueryDef } from '@pkgs/sync-engine-shared/queries-types';
import type { TopicMapEntry } from '@pkgs/sync-engine-shared/topic-map';
import type {
  AccountPrivacyContribution,
  AccountPrivacyGuard,
} from './account-privacy';

/** The literal names of the tables a feature declared. */
export type TableNamesOf<Tables extends readonly TableDef[]> =
  Tables[number]['name'];

/**
 * Wake topics for the feature's own tables. Keys are constrained to the
 * declared table names, so a topic map entry for a table the feature does not
 * own is a type error rather than a silent cross-feature reach.
 */
export type TopicMapFor<TableName extends string> = {
  readonly [K in TableName]?: TopicMapEntry;
};

/** A feature's writes, loaded on demand. */
export type LoadMutations = () => Promise<readonly Mutation<unknown>[]>;

export type FeatureManifest<
  Name extends string = string,
  Tables extends readonly TableDef[] = readonly TableDef[],
> = {
  readonly name: Name;
  /**
   * The domain tables this feature owns. No other feature may declare them,
   * and the composed schema is exactly the union across features.
   */
  readonly tables: Tables;
  /** Wake topics for this feature's tables (see {@link TopicMapFor}). */
  readonly topicMap: TopicMapFor<TableNamesOf<Tables>>;
  /**
   * Tables owned by *other* features that this feature's queries read.
   *
   * A feature's own tables need no declaration. Naming a foreign table here
   * is how a read across a bounded context becomes visible and checkable
   * instead of implicit: the boundary check fails on any foreign table a
   * query touches that is not listed, and on any listed table no feature in
   * the composition owns. Prefer a port over adding to this list.
   */
  readonly readsForeign?: readonly string[];
  /**
   * Synced reads. Query definitions are SQL text plus a channel projection —
   * small enough to fold eagerly.
   */
  readonly queries: readonly QueryDef<unknown>[];
  /**
   * Queries a signed-in client holds open for the whole session, by name.
   * These are what the local database is kept warm with, so a feature says
   * which of its reads are session-scoped rather than the shell guessing.
   */
  readonly sessionQueries?: readonly string[];
  /**
   * Writes, behind a thunk. Mutation bodies pull the feature's whole domain
   * layer, so they stay on their own chunk boundary: the client loads them
   * with its first sync engine, and a slice harness loads only what the
   * features under test declared.
   */
  readonly mutations: LoadMutations;
  readonly accountPrivacy?: AccountPrivacyContribution;
  readonly accountPrivacyGuard?: AccountPrivacyGuard;
};

/**
 * Declare a feature. Identity at runtime; the point is inference — `const`
 * keeps the table-name literals so {@link TopicMapFor} can constrain the
 * topic map to tables this feature actually owns.
 */
export function defineFeature<
  const Name extends string,
  const Tables extends readonly TableDef[],
>(manifest: FeatureManifest<Name, Tables>): FeatureManifest<Name, Tables> {
  return manifest;
}
