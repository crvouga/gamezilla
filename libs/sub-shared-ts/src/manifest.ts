import type { RegisteredTurnGame } from '@pkgs/turn-game-shared-ts/game-rules';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
/**
 * A sub manifest is the one thing a bounded context exports about itself.
 * It names the slice of every layer the sub owns — domain tables, synced
 * reads, writes — so the composition root can fold a tree of subs into an
 * app without knowing what any of them is.
 *
 * Sibling subs never import each other, and nothing here imports a product
 * sub: the fold is generic over what subs declare. Cross-sub needs are ports
 * the sub declares from its own point of view and the composition root
 * fills in.
 */

import type { TableDef } from '@pkgs/db-schema-root-shared-ts/define-table';
import type { Mutation } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { QueryDef } from '@pkgs/sync-engine-shared-ts/queries-types';
import type { TopicMapEntry } from '@pkgs/sync-engine-shared-ts/topic-map';
import type {
  AccountPrivacyContribution,
  AccountPrivacyGuard,
} from './account-privacy';

/** The literal names of the tables a sub declared. */
export type TableNamesOf<Tables extends readonly TableDef[]> =
  Tables[number]['name'];

/**
 * Wake topics for the sub's own tables. Keys are constrained to the
 * declared table names, so a topic map entry for a table the sub does not
 * own is a type error rather than a silent cross-sub reach.
 */
export type TopicMapFor<TableName extends string> = {
  readonly [K in TableName]?: TopicMapEntry;
};

/** A sub's eagerly imported writes, composed asynchronously. */
export type LoadMutations = () => Promise<readonly Mutation<unknown>[]>;

export type SubManifest<
  Name extends string = string,
  Tables extends readonly TableDef[] = readonly TableDef[],
> = {
  readonly name: Name;
  /** Nested subs of the same kind, folded after this node in listed order. */
  readonly subs?: readonly SubManifest[];
  /**
   * The domain tables this sub owns. No other sub may declare them, and the
   * composed schema is exactly the union across the walked tree.
   */
  readonly tables: Tables;
  /** Wake topics for this sub's tables (see {@link TopicMapFor}). */
  readonly topicMap: TopicMapFor<TableNamesOf<Tables>>;
  /**
   * Tables owned by *other* subs that this sub's queries read.
   *
   * A sub's own tables need no declaration. Naming a foreign table here is
   * how a read across a bounded context becomes visible and checkable
   * instead of implicit: the boundary check fails on any foreign table a
   * query touches that is not listed, and on any listed table no sub in
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
   * These are what the local database is kept warm with, so a sub says
   * which of its reads are session-scoped rather than the shell guessing.
   */
  readonly turnGames?: readonly RegisteredTurnGame[];
  readonly puzzleContents?: readonly {
    readonly id: string;
    readonly puzzleContent: PuzzleContent;
  }[];
  readonly sessionQueries?: readonly string[];
  /** Writes composed asynchronously from eagerly imported definitions. */
  readonly mutations: LoadMutations;
  readonly accountPrivacy?: AccountPrivacyContribution;
  readonly accountPrivacyGuard?: AccountPrivacyGuard;
};

/**
 * Declare a sub. Identity at runtime; the point is inference — `const`
 * keeps the table-name literals so {@link TopicMapFor} can constrain the
 * topic map to tables this sub actually owns.
 */
export function defineSub<
  const Name extends string,
  const Tables extends readonly TableDef[],
>(manifest: SubManifest<Name, Tables>): SubManifest<Name, Tables> {
  return manifest;
}
