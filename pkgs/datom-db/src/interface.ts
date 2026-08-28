// @ts-nocheck
// @biome-ignore
/**
 * ============================================================================
 *
 *  The complete public interface of a datom store queried by datalog.
 *
 *  One database, many backends: the engine runs unchanged in a browser or on
 *  a server, over memory, SQLite, Postgres, IndexedDB or object storage. This
 *  file declares types and entry points only — no implementations, and no
 *  backend named anywhere in it. A backend is a value handed to `open`,
 *  constructed by its own adapter package; how an adapter persists datoms
 *  is its business alone.
 *
 *  Four things this API is built to guarantee.
 *
 *  1. An immutable interface.
 *     Facts are `Datom`s and are never updated in place; a retraction is
 *     itself a fact. `Db` is a snapshot pinned to a basis transaction, so it
 *     is safe to hold across ticks and two reads from the same `Db` can never
 *     disagree. `Connection` is the only mutable thing in the system; how a
 *     backend arranges its commit point beneath it is the backend's concern.
 *     The single sanctioned exception is `Connection.excise`, which exists
 *     because the law demands erasure and is documented as the hole it is.
 *
 *  2. Time travel as a first-class operation, not an audit log.
 *     `asOf`, `since` and `history` return ordinary `Db`s, so every query
 *     works unchanged against any point in the past. Nothing is special-cased
 *     for historical reads — an old snapshot is just a database. Transactions
 *     are entities too (`TX`), so provenance — who wrote this, why — is
 *     ordinary data rather than a bolted-on `updated_by` column.
 *
 *  3. Sync primitives, not a sync framework.
 *     A query is the unit of replication. `Db.datoms` returns the datoms a
 *     query *read* — its footprint — so a peer that ingests them computes the
 *     identical answer locally; with `since`, it returns only the delta.
 *     `Connection.ingest` applies foreign datoms verbatim, preserving their
 *     original transaction ids, so peers' histories converge rather than fork.
 *     Policy — who wins a conflict, when to push, what to subscribe to — is
 *     deliberately left to the caller.
 *
 *  4. Full query expressiveness, from a minimal datalog core.
 *     Datalog is the only query language: nothing else in the system can
 *     find, filter, join or aggregate. `Db.pull` shapes already-found
 *     entities into trees but carries zero query power, and there is no
 *     escape into SQL. Seven clause forms and five `Query`
 *     fields cover joins, outer joins, unions, negation, existence tests,
 *     subqueries, recursion, grouping, aggregation and search. A query
 *     carries its row type: `Query<R>` returns `R[]`, objects keyed and
 *     typed by the caller's declaration, compiler-checked against the
 *     projection. Every construct in the query section is irreducible:
 *     anything derivable from the rest was cut, and the QUERY section
 *     documents each cut and its replacement. The one ordered read in the
 *     system, `Db.page` (with its raw sibling `Db.scan`), lives outside the
 *     query for a reason its note explains: it is not, and must never be,
 *     a sync unit.
 *
 *  Everything crossing this interface is data. No closures in queries, no
 *  opaque handles in results, and errors are data too — a `Query`, an
 *  `Op[]`, a `Footprint`, a `TxReport` and a `TxError` all serialize to
 *  JSON, which is what makes goal 3 possible at all.
 *
 * ============================================================================
 */

/**
 * ============================================================
 *  CORE VALUES
 * ============================================================
 */

/** UUIDv7 string. Clients mint their own — there are no tempids. */
export type EntityId = string & { readonly __e: unique symbol };

/** Namespaced attribute name, e.g. "person/name". */
export type Attr = string;

/** Monotonic transaction number. Total order within one database. */
export type TxId = number & { readonly __tx: unique symbol };

/**
 * One total order is pinned over all values — natural order within a
 * type, a fixed type ordering across types — so comparisons, scans,
 * page cursors and tie-breaks are deterministic on every peer.
 */
export type Value =
  | string
  | number
  | boolean
  | Date // instant
  | Uint8Array // bytes — small values; large blobs belong outside, store a key
  | EntityId; // ref

/** `op: true` asserts, `op: false` retracts. */
export interface Datom {
  readonly e: EntityId;
  readonly a: Attr;
  readonly v: Value;
  readonly tx: TxId;
  readonly op: boolean;
}

/** Stable identity of a datom, for dedup and set membership. */
export function key(d: Datom): string;

/** Reference an entity by a `unique` attribute instead of by id. */
export type LookupRef = readonly [Attr, Value];
export type Ref = EntityId | LookupRef;

export function newId(): EntityId;

/**
 * The id of the transaction being committed, usable as a `Ref` inside
 * that transaction's ops. Assert datoms on it to record provenance:
 *
 *   ['+', TX, 'tx/author', userId]
 *   ['+', TX, 'tx/reason', 'bulk import']
 *
 * A tx entity is an ordinary entity: query it, time-travel it, sync it.
 * This is the whole audit story — there is no other one.
 */
export declare const TX: EntityId;

/**
 * The entity id of a committed transaction. `Datom.tx` is a TxId —
 * a number, because ordering and `since` need one — while joins need
 * an entity id; this is the deterministic bridge. Inside queries the
 * 4th pattern position already binds the entity id, so this exists
 * only for correlating raw datoms (from a Footprint or `scan`) with
 * their tx datoms in the caller.
 */
export function txEntity(t: TxId): EntityId;

/**
 * ============================================================
 *  SCHEMA
 * ============================================================
 * Schema is stored as datoms like everything else, so it
 * time-travels and syncs. This is just the shape you transact.
 *
 * Re-transacting an attr is a migration, and only widenings are
 * accepted: card 'one' → 'many', adding `index`, adding `noHistory`.
 * Everything else — a type change, 'many' → 'one', adding `unique`
 * to an attr whose existing values already collide — is rejected
 * with 'schema-incompatible'. A narrowing is a new attr.
 *
 * Composite uniqueness (SQL's UNIQUE(a, b)) is a derived attr:
 *
 *   'member/key': { type: 'string', unique: 'identity',
 *                   from: ['concat', 'member/user', '|', 'member/group'] }
 *
 * The engine maintains the key in the same transaction as its
 * components, so it cannot drift and no caller ever writes it —
 * what used to be transaction discipline here is now a declaration.
 * The same mechanism carries case-insensitive collation and
 * compound sort keys; see `from` below.
 *
 * Also absent, on purpose: NOT NULL, foreign keys, CHECK. Entities
 * are open attribute bags, and `ingest` applies remote facts without
 * re-checking constraints, so global referential integrity is
 * unenforceable in a system that syncs — an engine that promised it
 * would be lying on every peer but one. What replaces them: cascade
 * is `component`; single-fact invariants are `cas`; multi-fact
 * invariants are `onBasis`; required-ness is validated in the caller
 * before transact and auditable after the fact by query —
 * ['not', ['?e', 'required/attr', '?v']] finds every violator.
 */

export interface AttrSpec {
  type: 'string' | 'number' | 'boolean' | 'instant' | 'bytes' | 'ref';
  /** default 'one' */
  card?: 'one' | 'many';
  /** upsert on conflict ('identity') vs. throw ('value') */
  unique?: 'identity' | 'value';
  /** retract children when parent is retracted */
  component?: boolean;
  /** maintain AVET index for value lookups — also what `scan('avet', …)` requires */
  index?: boolean;
  /**
   * Marks this attr as computed: the engine asserts and retracts it
   * in the same transaction as its sources, and rejects direct
   * writes ('derived-attr'). Everything else about it is ordinary —
   * index it, make it unique, search it, page by it, sync it. This
   * is SQL's generated column, and it exists so a computed value is
   * declared once instead of maintained by hand in every transact:
   * case-insensitive collation is ['lower', a]; composite uniqueness
   * and compound sort keys are ['concat', a, '|', b]; group-by-month
   * is ['trunc', a, 'month']. Sources are card-one attrs of the same
   * entity, and the derived value exists exactly when every source
   * does. Like the fts analyzer, the functions are pinned and
   * versioned: peers must derive identically or footprints lie.
   */
  from?: Derive;
  /**
   * Maintain a full-text index over this attr's values (string attrs
   * only). What `index` is to exact values, this is to words: it
   * enables the 'fts' clause, and nothing else changes — the indexed
   * facts are still datoms, so search time-travels and syncs.
   */
  fulltext?: boolean;
  /** keep only the current value; drop prior values from history */
  noHistory?: boolean;
}

/**
 * A derived attribute's computation: pure, deterministic, and data,
 * evaluated over the entity's own attrs. Three functions cover the
 * collation, composite-key and date-bucketing needs that SQL meets
 * with expressions; anything richer belongs in the caller, as a
 * plain attr it computes and owns.
 */
export type Derive =
  | readonly ['lower', Attr]
  | readonly ['concat', ...(Attr | string)[]] // string literals are separators
  | readonly ['trunc', Attr, 'year' | 'month' | 'day' | 'hour'];

export type Schema = Record<Attr, AttrSpec>;

/**
 * ============================================================
 *  TRANSACTIONS
 * ============================================================
 */

export type Op =
  | readonly ['+', Ref, Attr, Value]
  /** omit v to retract all values of a; omit a to retract the entity */
  | readonly ['-', Ref, Attr, Value]
  | readonly ['-', Ref, Attr]
  | readonly ['-', Ref]
  /** compare-and-set, for optimistic concurrency on a single fact */
  | readonly ['cas', Ref, Attr, Value | null, Value]
  | readonly ['schema', Schema];

export interface TxOptions {
  /**
   * Whole-database optimistic concurrency. Rejects with 'basis-moved'
   * if the store has advanced past this basis. `cas` guards one fact;
   * this guards a read-modify-write of any shape: take a `Db`, compute
   * ops from what it says, transact with `onBasis: db.basis`, retry on
   * rejection. Between the two, transaction functions are not needed,
   * so there are none — logic stays in the caller and ops stay data.
   */
  onBasis?: TxId;
}

/**
 * Pure data — the wire format of `log` and the payload of `on('tx')`,
 * so it must serialize, and now it does: no Db handles inside. The
 * snapshots either side of a transaction are derivable — asOf(tx),
 * and asOf of the tx before it — so they are not carried. `at` is
 * also asserted by the engine as a datom on the tx entity, under the
 * reserved attr 'tx/at': that is what lets asOf(Date) resolve against
 * ingested history, and lets queries join on time like any value.
 */
export interface TxReport {
  tx: TxId;
  at: Date;
  /** exactly what changed — this is what you ship upstream */
  datoms: Datom[];
}

/**
 * Everything that can go wrong at commit, as data. `transact` and
 * `ingest` reject with a `TxRejected` whose `reason` is one of these;
 * being JSON, a rejection crosses a process boundary intact, which
 * matters when the transactor is on the other end of a wire.
 */
export type TxError =
  | { code: 'unique-conflict'; attr: Attr; value: Value; holder: EntityId }
  | {
      code: 'cas-failed';
      e: EntityId;
      a: Attr;
      expected: Value | null;
      actual: Value | null;
    }
  | { code: 'basis-moved'; expected: TxId; actual: TxId }
  | { code: 'type-mismatch'; attr: Attr; value: Value }
  | { code: 'unknown-attr'; attr: Attr }
  | { code: 'derived-attr'; attr: Attr }
  | { code: 'schema-incompatible'; attr: Attr; reason: string };

export class TxRejected extends Error {
  readonly reason: TxError;
}

/**
 * ============================================================
 *  QUERY  (datalog)
 * ============================================================
 * Everything here is irreducible: nothing in this section can be
 * expressed in terms of the rest. What was cut, and how to get it:
 *
 *   or            → a rule with two bodies
 *   get-else,     → a rule with two bodies, one negated:
 *   coalesce         [['?e'], ['?e','a','?v']] | [['?e'], ['not',...], ['=','?v',dflt]]
 *   missing       → ['not', ['?e', 'attr', '?v']]
 *   in (static)   → a rule with one body per member; for runtime
 *                    lists, a collection input — see `in` below
 *   between       → two comparisons
 *   exists        → a rule; not-exists → ['not', ['rule', …]]
 *   like,         → 're', with `escapeRe` around runtime needles
 *   starts-with
 *   entity (flat) → the pattern ['?e', '?a', '?v'] with ?e bound,
 *                    or `Db.scan('eavt', [e])`; the *tree* read is
 *                    `Db.pull`, which is a projection, not a query
 *   avg           → find count and sum, divide in the caller
 *   having        → filter the returned rows; they are already grouped
 *   distinct      → the default; results are sets
 *   count(DISTINCT x) → also the default; `with` is what opts out
 *   fts OR / NOT, → rules and `not`, same as everything else: one
 *   multi-attr       body per alternative, one per attr for a global
 *   search           search box. The query string never needs
 *                    boolean syntax of its own.
 *   ranking       → a score is not a fact, so none is bound; order
 *                    matches in the caller — see the 'fts' clause
 *   relation      → `Db.with`: transact the ephemeral rows as datoms
 *   inputs           into a hypothetical db and join normally. This
 *                    covers "join my query against this client-side
 *                    table" without a binding form for it.
 *   _             → a var used once
 *
 * Deliberately absent from Query itself: order, limit, offset,
 * window functions. A datalog result is a set, not a sequence, and
 * a `limit` inside a query would make it useless as a sync unit —
 * the footprint would still be the whole scan. Ordering is a
 * read-time concern, so it lives on `Db` instead: `page` runs an
 * ordinary Query and returns one ordered, bounded, resumable slice
 * of it. The same query object syncs via `datoms`, live-updates via
 * `watch`, and pages via `page`. Offset stays absent everywhere:
 * `page`'s `after` cursor is what OFFSET pretends to be, without
 * drifting under concurrent writes.
 *
 * Also absent: date, string and cast functions. Values are opaque to
 * queries apart from ordering, arithmetic and `re`, because
 * computation over values is a schema concern, not a query concern:
 * to group by month or sort case-insensitively, declare a derived
 * attr (`AttrSpec.from`) and pattern-match it — declared once,
 * engine-maintained, indexed, and never written by hand.
 */

export type Var = `?${string}`;
export type Term = Var | Value;

/** one named argument: a scalar for a `Var` binding, a list for `[Var]` */
export type Input = Value | readonly Value[];
/** a query's arguments — one entry per name in its `in` */
export type InputMap = Record<string, Input>;

/** `collect` yields many values in one cell; every other cell is scalar */
export type Cell = Value | readonly Value[];

/**
 * The shape a query's rows come back in: an object per row, keyed
 * and typed by the query's required generic. `Query<R>` is the
 * query's contract with the type system — `find` must have exactly
 * R's keys, which the compiler enforces, while each key's value
 * type is the author's declaration: trusted, not proven, the same
 * bargain as sql<SearchHitRow>`…`. Rows are objects, so projection
 * order is meaningless and consumption is by name, not position.
 */
export type RowShape = Record<string, Cell>;

export interface Query<R extends RowShape> {
  /**
   * Projection: one entry per column of R. A bare Var projects its
   * binding; [Agg, Var] aggregates it. Grouping is implicit — every
   * non-aggregate entry — and because output columns are named by
   * their key, min and max of the same var no longer collide:
   * { fastest: ['min','?t'], slowest: ['max','?t'] }.
   */
  find: { readonly [K in keyof R]: FindElem };
  /**
   * Named parameters, bound by key from the `inputs` map — names,
   * not positions, for the same reason `find` is a record: two
   * arguments of the same type can never be silently swapped, and a
   * Footprint's echoed inputs read as what they are. A bare Var
   * binds a scalar; `['?x']` binds a collection — the query runs as
   * if unioned over its elements. A static list is derivable (one
   * rule body per member), but a runtime list — "these 50 ids", the
   * commonest parameter shape in a product app — would force
   * rewriting the query per call, and a query whose shape changes
   * per call is useless as a reusable sync unit. So this one earns
   * its place.
   */
  in?: { readonly [name: string]: Var | readonly [Var] };
  where: readonly Clause[];
  /**
   * Kept in the tuple during aggregation but not projected. The only
   * way to opt out of set semantics — without it, `sum` over two
   * entities that happen to share a value counts that value once.
   */
  with?: readonly Var[];
  /** a name may have several bodies; that is how disjunction is written */
  rules?: Record<string, readonly Rule[]>;
}

export type FindElem = Var | readonly [Agg, Var];

/**
 * `collect` returns the group's values in one cell. It is the escape
 * hatch: median, stddev, top-n and string joining are all derived
 * from it in the caller, so they are not aggregates here.
 */
export type Agg = 'count' | 'sum' | 'min' | 'max' | 'collect';

/** [params, ...body] */
export type Rule = readonly [readonly Var[], ...Clause[]];

export type Clause =
  /**
   * Pattern — the only way to read a datom. Repeated vars join.
   * Optional 4th and 5th positions bind a datom's provenance: the
   * 4th binds its transaction — as the tx *entity* id, so it joins
   * straight onto tx datoms like 'tx/author' — and the 5th binds
   * `op`, meaningful only against a `history()` db. Without these,
   * "who changed what, when" is unaskable; with them, audit is a
   * join, not an API.
   */
  | readonly [Var | Ref, Attr | Var, Term]
  | readonly [Var | Ref, Attr | Var, Term, Var]
  | readonly [Var | Ref, Attr | Var, Term, Var, Var]
  /**
   * Comparison. All six are derivable from '<', '=' and `not`, but
   * they are one concept, so they are spelled six ways.
   */
  | readonly [Cmp, Term, Term]
  /**
   * Regex — the one string predicate. ['re', '?v', pattern]. The
   * pattern is a Term, so it binds from `inputs` like any value —
   * which is what lets a search query stay one static object across
   * keystrokes instead of being rebuilt per needle. Runtime needles
   * must be escaped (`escapeRe`) and anchored by the caller; the
   * regex dialect, like the fts analyzer, is pinned and versioned so
   * peers match identically.
   */
  | readonly ['re', Term, Term]
  /**
   * Full-text search — a generator, like a pattern: binds ?e (and
   * optionally the matched value) for every entity whose `a` matches
   * the query string. `a` must be literal and declared `fulltext`.
   *
   * The query string knows only three things: terms, which are AND'd;
   * "double quotes" for a phrase; a trailing * for a prefix. It has
   * no boolean syntax because datalog already does — OR is a rule
   * with one body per alternative, NOT is ['not', ['fts', …]], and a
   * global search box is one body per fulltext attr. The analyzer
   * (Unicode case folding + word segmentation) is pinned and
   * versioned: two peers must tokenize identically or footprints lie.
   *
   * Sync and time travel follow from treating this as a pattern: its
   * footprint is the datoms it matched, a `since` delta is newly
   * matching datoms plus retractions of old matches, and against an
   * `asOf` db it searches what was asserted then.
   *
   * Deliberately unbound: a relevance score. A score is not a fact —
   * it shifts when unrelated documents change, differs across index
   * versions, and would poison byte-identical replay. Matching is
   * the engine's job; ranking is the caller's, which holds the
   * matched values anyway.
   */
  | readonly ['fts', Var | Ref, Attr, Term, Var?]
  /** arithmetic — binds its final argument. ['*', '?a', '?b', '?out'] */
  | readonly [Arith, Term, Term, Var]
  /** stratified negation over a conjunction */
  | readonly ['not', ...Clause[]]
  /**
   * Rule invocation. Subsumes disjunction, recursion, subqueries and
   * EXISTS. Tagged because a 3-arity call is otherwise a pattern.
   */
  | readonly ['rule', string, ...Term[]];

export type Cmp = '=' | '!=' | '<' | '<=' | '>' | '>=';
export type Arith = '+' | '-' | '*' | '/';

/**
 * A pull selector: which attrs to read and which refs to follow,
 * for `Db.pull`. Deliberately zero query power — no predicates, no
 * joins beyond following a ref, no aggregation — which is what keeps
 * datalog the only query language: a selector cannot *find* anything,
 * only shape entities already found.
 *
 *   ['note/title', 'note/tag',            // attrs; card-many → array
 *    { 'note/folder': ['folder/name'] },  // follow a ref into a subtree
 *    { 'comment/_note': ['comment/text'] }] // '_' walks the ref backwards
 *
 * '*' selects every current attr (refs as ids); '...' as a subtree
 * recurs with the enclosing selector, which is how a folder chain or
 * a component tree is read to any depth.
 */
export type Pull = readonly (
  | Attr // 'ns/name', or 'ns/_name' reversed
  | '*'
  | { readonly [a: Attr]: Pull | '...' }
)[];

/**
 * ============================================================
 *  DB — an immutable snapshot
 * ============================================================
 * A Db is a cheap handle pinned to a basis tx, not a materialized
 * value. Reads are async because backends are. Holding one across
 * ticks is safe: history is append-only, so a basis never changes.
 */

/** the four sort orders every backend maintains */
export type Index = 'eavt' | 'aevt' | 'avet' | 'vaet';

export interface Db {
  readonly basis: TxId;

  query<R extends RowShape>(q: Query<R>, inputs?: InputMap): Promise<R[]>;

  /**
   * THE SYNC PRIMITIVE.
   * Returns the set of datoms this query read — its footprint —
   * rather than the answer. Ingest these into another store and
   * the same query there returns identical rows.
   *
   * With `since`, returns only the footprint delta: datoms
   * asserted or retracted after `since` that the query depends
   * on, including retractions of facts that have left the result.
   *
   * The footprint is what the query *read*, taken before aggregation
   * — a `count` therefore syncs the whole population it counted.
   */
  datoms<R extends RowShape>(
    q: Query<R>,
    opts?: { inputs?: InputMap; since?: TxId }
  ): Promise<Footprint<R>>;

  /**
   * THE PAGINATION PRIMITIVE — and the only ordered read.
   * Walks one index in sort order from a prefix, yielding datoms
   * until you stop or `limit` does. "Newest 50 of 100k" through
   * `query` means materializing 100k rows and slicing; here it
   * means reading 50 datoms:
   *
   *   scan('avet', ['msg/sentAt'], { reverse: true, limit: 50 })
   *
   * The prefix is components of the index's sort key, in index
   * order: scan('eavt', [e]) is every fact about e — the entity
   * read; scan('avet', [a, v]) seeks a value; scan('vaet', [ref])
   * is every entity pointing at ref. Compound orderings are the
   * same idiom as SQL composite indexes: store a sortable composite
   * value and index that attr.
   *
   * Deliberately NOT a sync unit: an ordered, bounded range has no
   * stable footprint — the 51st datom moves it. Sync with `datoms`;
   * page with `scan`. Runs against `asOf`/`since`/`history` Dbs
   * like everything else, which also makes it the bulk-export and
   * backup read.
   *
   * `start` (inclusive) and `end` (exclusive) bound the first key
   * component after the prefix — the range seek behind SQL's
   * BETWEEN, LIKE 'q%' and keyset pagination:
   *
   *   scan('avet', ['user/handle'], { start: 'ab', end: 'ab\uffff' })
   *
   * 'avet' requires `index` or `unique` on the attr; 'vaet' exists
   * only for ref attrs.
   */
  scan(
    index: Index,
    prefix: readonly Value[],
    opts?: { limit?: number; reverse?: boolean; start?: Value; end?: Value }
  ): AsyncIterable<Datom>;

  /**
   * THE RELATIONAL PAGE — `scan` generalized from one index to one
   * query. Runs q, orders its rows, returns one bounded slice:
   * SQL's WHERE + ORDER BY + LIMIT in a single round trip, with
   * joins, negation and hydration inside the query where they
   * belong, instead of re-filtered around a raw index walk.
   *
   * `by` names a column of R — a key, so the compiler catches a
   * typo'd sort column at the call site. The total order is `by`,
   * then the remaining columns in lexicographic key order, so ties
   * break deterministically without each call saying how; `reverse`
   * flips the whole order. `after` is the previous page's last row,
   * and the next page resumes strictly beyond it — keyset
   * pagination, immune to the drift that makes OFFSET lie under
   * concurrent writes. Against a single Db basis, successive pages
   * tile the result exactly, no gaps and no repeats.
   *
   * q stays an ordinary, unordered Query: sync it with `datoms`,
   * watch it with `watch`, page it here. The page itself is not a
   * sync unit, for the same reason a scan is not. When `by` comes
   * off an indexed attr the engine may answer with a range walk
   * rather than materializing q — but that is a planner's business,
   * not the contract's.
   */
  page<R extends RowShape>(
    q: Query<R>,
    opts: {
      inputs?: InputMap;
      by: keyof R & string;
      reverse?: boolean;
      limit: number;
      after?: R;
    }
  ): Promise<R[]>;

  /**
   * THE SHAPED READ — the third and last read form. `query`/`page`
   * answer "which entities"; `pull` answers "everything about these,
   * as a tree." One call returns nested objects — card-many attrs as
   * arrays, followed refs as subtrees — instead of the cartesian
   * rows that sibling collections produce under a join (3 tags ×
   * 5 comments is 15 rows relationally, one tree here) and instead
   * of a query per level. The idiom for a screen is two calls:
   * `page` picks the ids, `pullMany` shapes them.
   *
   * T is the tree's declared type, trusted exactly like Query's R.
   * A pull reads precisely the datoms of its tree, so it composes
   * with `asOf`/`history` like every read. It carries no query
   * power at all — filtering, sorting or aggregating a subtree is a
   * job for datalog, by design.
   */
  pull<T>(ref: Ref, selector: Pull): Promise<T | null>;
  /** one round trip for a page of trees; result order and length mirror `refs` */
  pullMany<T>(
    refs: readonly Ref[],
    selector: Pull
  ): Promise<readonly (T | null)[]>;

  // ── time travel ──
  /** snapshot as it was at t (inclusive) */
  asOf(t: TxId | Date): Db;
  /** only datoms asserted after t — for "what's new" queries */
  since(t: TxId | Date): Db;
  /** every datom ever, retractions included; `op` is meaningful here */
  history(): Db;

  /** hypothetical: apply ops in memory, get a Db, persist nothing */
  with(ops: readonly Op[]): Promise<Db>;
}

export interface Footprint<R extends RowShape = RowShape> {
  datoms: Datom[];
  /** basis of the snapshot these came from */
  basis: TxId;
  /** echoed back so the consumer can re-run identically */
  query: Query<R>;
  inputs: InputMap;
}

/**
 * ============================================================
 *  CONNECTION — the only mutable thing
 * ============================================================
 */

export interface Connection {
  /** current snapshot */
  db(): Db;

  /** rejects with TxRejected; `reason` says why, as data */
  transact(ops: readonly Op[], opts?: TxOptions): Promise<TxReport>;

  /**
   * Apply foreign datoms verbatim, preserving their original tx
   * ids. Idempotent. This is how a peer absorbs a Footprint —
   * it must not mint a local tx, or histories would diverge.
   *
   * Constraints are a transact-time concern and are NOT re-checked
   * here: a fact a peer committed is a fact, even when it collides
   * with one committed locally. Where two live assertions compete —
   * card 'one', or `unique` — the current value is the one with the
   * greater tx id, deterministically, on every peer, so ingestion
   * order never matters. Anything smarter than that is policy, and
   * policy lives in the caller: read both, decide, transact.
   */
  ingest(datoms: readonly Datom[]): Promise<{ applied: number; basis: TxId }>;

  /**
   * The one sanctioned hole in immutability: remove datoms from
   * history as if never asserted, for the erasures the law demands.
   * An entity target removes every datom about it; an [entity, attr]
   * target removes one attribute's history. The excision itself is
   * recorded — as datoms on an excision entity — so it syncs like
   * any fact and peers converge on the removal: what disappears is
   * the data, never the fact that something was removed. After it,
   * `asOf` and `history` no longer see the excised datoms. Not a
   * modeling tool; retraction is.
   */
  excise(targets: readonly (Ref | readonly [Ref, Attr])[]): Promise<TxReport>;

  /** raw tx log, for replication and audit; bounds are (from, to] — from exclusive, like `since` */
  log(from?: TxId, to?: TxId): AsyncIterable<TxReport>;

  /** fires once per committed or ingested tx */
  on(event: 'tx', fn: (r: TxReport) => void): () => void;

  close(): Promise<void>;
}

/**
 * A backend, by value. The core names no backend and keeps no
 * registry: an adapter package exports a constructor that captures
 * its own, fully typed configuration —
 *
 *   open({ backend: postgres({ sql }) })   // @datom/postgres
 *   open({ backend: sqlite({ sql }) })     // @datom/sqlite
 *   open({ backend: memory() })            // @datom/memory
 *
 * — so adding a backend is publishing a package, not editing this
 * file, and no driver type ever appears in the core. The engine ↔
 * adapter contract behind the brand is an SPI versioned separately;
 * it is deliberately absent here because callers hold Backends,
 * they don't implement them. How an adapter persists — SQL rows,
 * content-addressed blocks over a KV store, files — is an
 * implementation detail behind the same brand, invisible from this
 * side of it. What every adapter must uphold is not a storage shape
 * but the observable contracts above: append-only history, stable
 * bases, a total transaction order, and identical answers from
 * identical datoms.
 */
export interface Backend {
  readonly __backend: unique symbol;
}

export interface OpenOptions {
  backend: Backend;
  /** asserted on open if absent; no-op if unchanged; widenings only — see SCHEMA */
  schema?: Schema;
}

export function open(opts: OpenOptions): Promise<Connection>;

/**
 * ============================================================
 *  SUGAR  (built on the above, zero new capability)
 * ============================================================
 */

/** map form → ops */
export function entity(m: { id?: Ref } & Record<Attr, Value | Value[]>): Op[];

/**
 * Escape a runtime string for use inside an 're' pattern, so user
 * input matches itself rather than acting as syntax. LIKE 'q%' is
 * ['re', '?v', p] with p bound to '^' + escapeRe(q).
 */
export function escapeRe(s: string): string;

/** re-runs q on any tx that could touch its footprint */
export function watch<R extends RowShape>(
  conn: Connection,
  q: Query<R>,
  inputs: InputMap,
  fn: (rows: R[], db: Db) => void
): () => void;

/**
 * ============================================================
 *  EXAMPLE — a note-taking app, end to end
 * ============================================================
 * Users own folders, folders nest, notes live in folders. Nothing
 * below defines anything new; it only exercises what is above, and
 * it touches every entry point once.
 */

interface ExampleIds {
  ada: EntityId;
  inbox: EntityId;
  work: EntityId;
  note: EntityId;
}

const EXAMPLE_INSTANT = new Date('2024-01-15T12:00:00.000Z');
const EXAMPLE_YESTERDAY = new Date('2024-01-14T12:00:00.000Z');

interface ExampleFolderView {
  'folder/name': string;
  'note/_folder': readonly { 'note/title': string }[];
  'folder/parent': ExampleFolderView | null;
}

const EXAMPLE_IN_FOLDERS: Query<{ title: string; fname: string }> = {
  find: { title: '?title', fname: '?fname' },
  in: { handle: '?handle' },
  where: [
    ['?u', 'user/handle', '?handle'],
    ['?f', 'folder/owner', '?u'],
    ['?f', 'folder/name', '?fname'],
    ['?n', 'note/folder', '?f'],
    ['?n', 'note/title', '?title'],
  ],
};

const EXAMPLE_UNDER: Query<{ title: string }> = {
  find: { title: '?title' },
  in: { root: '?root' },
  where: [
    ['rule', 'in-tree', '?f', '?root'],
    ['?n', 'note/folder', '?f'],
    ['?n', 'note/title', '?title'],
  ],
  rules: {
    'in-tree': [
      [
        ['?f', '?root'],
        ['=', '?f', '?root'],
      ],
      [
        ['?f', '?root'],
        ['?f', 'folder/parent', '?mid'],
        ['rule', 'in-tree', '?mid', '?root'],
      ],
    ],
  },
};

const EXAMPLE_EMPTY: Query<{ fname: string }> = {
  find: { fname: '?fname' },
  where: [
    ['?f', 'folder/name', '?fname'],
    ['not', ['?n', 'note/folder', '?f']],
  ],
};

const EXAMPLE_PER_FOLDER: Query<{
  fname: string;
  notes: number;
  tags: readonly string[];
}> = {
  find: { fname: '?fname', notes: ['count', '?n'], tags: ['collect', '?tag'] },
  where: [
    ['?f', 'folder/name', '?fname'],
    ['?n', 'note/folder', '?f'],
    ['?n', 'note/tag', '?tag'],
  ],
};

const EXAMPLE_BY_IDS: Query<{ n: EntityId; title: string }> = {
  find: { n: '?n', title: '?title' },
  in: { n: ['?n'] },
  where: [['?n', 'note/title', '?title']],
};

const EXAMPLE_SEARCH: Query<{ n: EntityId; hit: string }> = {
  find: { n: '?n', hit: '?hit' },
  in: { needle: '?needle' },
  where: [['rule', 'matches', '?n', '?needle', '?hit']],
  rules: {
    matches: [
      [
        ['?n', '?q', '?hit'],
        ['fts', '?n', 'note/title', '?q', '?hit'],
      ],
      [
        ['?n', '?q', '?hit'],
        ['fts', '?n', 'note/body', '?q', '?hit'],
      ],
    ],
  },
};

const EXAMPLE_LAST_EDITOR: Query<{ title: string; who: string }> = {
  find: { title: '?title', who: '?who' },
  where: [
    ['?n', 'note/title', '?title', '?tx'],
    ['?tx', 'tx/author', '?u'],
    ['?u', 'user/handle', '?who'],
  ],
};

async function exampleSeed(conn: Connection): Promise<ExampleIds> {
  await conn.transact([
    [
      'schema',
      {
        'user/handle': { type: 'string', unique: 'identity', index: true },
        'user/name': { type: 'string' },
        'folder/name': { type: 'string', index: true },
        'folder/owner': { type: 'ref' },
        'folder/parent': { type: 'ref' },
        'note/title': { type: 'string', index: true, fulltext: true },
        'note/body': { type: 'string', fulltext: true },
        'note/folder': { type: 'ref' },
        'note/tag': { type: 'string', card: 'many', index: true },
        'note/updatedAt': { type: 'instant', index: true },
        'note/month': {
          type: 'instant',
          index: true,
          from: ['trunc', 'note/updatedAt', 'month'],
        },
        'tx/author': { type: 'ref' },
      },
    ],
  ]);

  const ada = newId(),
    inbox = newId(),
    work = newId(),
    note = newId();

  await conn.transact([
    ...entity({ id: ada, 'user/handle': 'ada', 'user/name': 'Ada Lovelace' }),
    ...entity({ id: inbox, 'folder/name': 'inbox', 'folder/owner': ada }),
    ...entity({
      id: work,
      'folder/name': 'work',
      'folder/owner': ada,
      'folder/parent': inbox,
    }),
    ...entity({
      id: note,
      'note/title': 'engine sketch',
      'note/body': 'the mill weaves algebraic patterns…',
      'note/folder': work,
      'note/tag': ['analytical', 'draft'],
      'note/updatedAt': EXAMPLE_INSTANT,
    }),
    ['+', TX, 'tx/author', ada],
  ]);

  await conn.transact([
    [
      '+',
      ['user/handle', 'ada'],
      'user/name',
      'Ada King, Countess of Lovelace',
    ],
    ['+', TX, 'tx/author', ada],
  ]);

  return { ada, inbox, work, note };
}

async function exampleQueries(db: Db, ids: ExampleIds): Promise<void> {
  const { inbox, note } = ids;

  await db.query(EXAMPLE_IN_FOLDERS, { handle: 'ada' });
  await db.query(EXAMPLE_UNDER, { root: inbox });
  await Promise.all([db.query(EXAMPLE_EMPTY), db.query(EXAMPLE_PER_FOLDER)]);
  await db.query(EXAMPLE_BY_IDS, { n: [note /* …forty-nine more */] });
  await db.query(EXAMPLE_SEARCH, { needle: 'algebra mill*' });
  await db.datoms(EXAMPLE_SEARCH, { inputs: { needle: 'algebra mill*' } });
}

async function exampleScanAndPull(db: Db, ids: ExampleIds): Promise<void> {
  const { inbox, work, note } = ids;

  for await (const d of db.scan('avet', ['note/updatedAt'], {
    reverse: true,
    limit: 20,
  })) {
    d.e;
  }
  for await (const d of db.scan('eavt', [note])) void d;
  for await (const d of db.scan('vaet', [work])) void d;

  const page1 = await db.page(EXAMPLE_PER_FOLDER, {
    by: 'notes',
    reverse: true,
    limit: 10,
  });
  await db.page(EXAMPLE_PER_FOLDER, {
    by: 'notes',
    reverse: true,
    limit: 10,
    after: page1.at(-1)!,
  });
  page1[0]?.tags;

  const card = await db.pull<{
    'note/title': string;
    'note/tag': readonly string[];
    'note/folder': { 'folder/name': string };
  }>(note, ['note/title', 'note/tag', { 'note/folder': ['folder/name'] }]);
  card?.['note/folder']['folder/name'];

  const tree = await db.pull<ExampleFolderView>(work, [
    'folder/name',
    { 'note/_folder': ['note/title'] },
    { 'folder/parent': '...' },
  ]);
  tree?.['folder/parent']?.['folder/name'];

  await db.pullMany<Record<string, Cell>>([inbox, work], ['*']);
}

async function exampleConcurrency(
  conn: Connection,
  ids: ExampleIds
): Promise<void> {
  const { ada, inbox, note } = ids;

  await conn.transact([
    ['cas', note, 'note/title', 'engine sketch', 'engine notes'],
    ['+', note, 'note/updatedAt', EXAMPLE_INSTANT],
    ['+', TX, 'tx/author', ada],
  ]);

  const snap = conn.db();
  await conn
    .transact([['+', note, 'note/folder', inbox]], { onBasis: snap.basis })
    .catch((e: TxRejected) =>
      e.reason.code === 'basis-moved' ? undefined : Promise.reject(e)
    );
}

async function exampleProvenanceAndHistory(
  conn: Connection,
  ids: ExampleIds
): Promise<void> {
  const { note } = ids;

  await conn.db().query(EXAMPLE_LAST_EDITOR);

  const yesterday = conn.db().asOf(EXAMPLE_YESTERDAY);
  await yesterday.query(EXAMPLE_IN_FOLDERS, { handle: 'ada' });

  for await (const d of conn.db().history().scan('eavt', [note])) {
    if (d.a === 'note/title') void [d.v, d.tx, d.op];
  }
}

async function exampleSyncAndLive(
  conn: Connection,
  ids: ExampleIds
): Promise<() => void> {
  const { ada, inbox, note } = ids;

  const fp = await conn.db().datoms(EXAMPLE_UNDER, { inputs: { root: inbox } });
  await conn
    .db()
    .datoms(EXAMPLE_UNDER, { inputs: { root: inbox }, since: fp.basis });
  for await (const report of conn.log(fp.basis)) void report.datoms;

  const stop = watch(
    conn,
    EXAMPLE_UNDER,
    { root: inbox },
    (rows, at) => void [rows, at.basis]
  );

  const maybe = await conn.db().with([['-', note]]);
  await maybe.query(EXAMPLE_PER_FOLDER);

  await conn.excise([ada, [note, 'note/body']]);

  return stop;
}

export async function example({ conn }: { conn: Connection }) {
  const ids = await exampleSeed(conn);
  const db = conn.db();

  await exampleQueries(db, ids);
  await exampleScanAndPull(db, ids);
  await exampleConcurrency(conn, ids);
  await exampleProvenanceAndHistory(conn, ids);

  const stop = await exampleSyncAndLive(conn, ids);
  stop();
  await conn.close();
}
