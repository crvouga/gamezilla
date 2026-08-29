// @ts-nocheck
// biome-ignore-all lint: draft public interface — suppress until production-shaped
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
 *  This file is the contract, whole. Every grammar rule, ordering, encoding
 *  and failure mode a caller (or a code generator, or a model with no other
 *  context) needs is written here, next to the thing it governs. If behavior
 *  is not specified here, it is not promised. Reading order: CORE VALUES and
 *  LEXICAL GROUND RULES define the atoms and the disambiguation rules
 *  everything else leans on; SCHEMA and TRANSACTIONS define writes; QUERY
 *  defines the one query language and QUERY TYPING the schema-free
 *  structural types over it; DB defines the four reads; CONNECTION defines
 *  mutation, sync ingestion, erasure and lifecycle; SUGAR holds the
 *  zero-capability helpers including the runtime validators; the EXAMPLE at
 *  the bottom exercises every entry point once.
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
 *     ordinary data rather than a bolted-on `updated_by` column. The
 *     composition algebra of the time-travel views is pinned on `Db`.
 *
 *  3. Sync primitives, not a sync framework.
 *     A query is the unit of replication. `Db.datoms` returns the datoms a
 *     query *read* — its footprint — so a peer that ingests them computes the
 *     identical answer locally; with `since`, it returns only the delta.
 *     `Connection.ingest` applies foreign datoms verbatim, preserving their
 *     original transaction ids, so peers' histories converge rather than
 *     fork. Convergence is possible because transaction identity is globally
 *     unique — a `TxId` is a hybrid-logical-clock string qualified by the
 *     minting store's origin id (see TxId), so two offline peers can never
 *     mint the same id and the conflict rule "greater tx id wins" is total.
 *     Policy — who wins beyond that default, when to push, what to subscribe
 *     to — is deliberately left to the caller.
 *
 *  4. Queries are plain, application-independent data — typed structurally.
 *     Datalog is the only query language: nothing else in the system can
 *     find, filter, join or aggregate. A query is a plain object literal:
 *     no constructor, no builder, no schema import, nothing to call — the
 *     object you write is the object that runs, syncs, and crosses the
 *     wire. Seven clause forms and five `Query` fields cover joins, outer
 *     joins, unions, negation, existence tests, subqueries, recursion,
 *     grouping, aggregation and search; every construct is irreducible,
 *     and the QUERY section documents each cut and its replacement.
 *
 *     Typing follows the same independence. What a query's *text* alone
 *     proves is inferred structurally at the call site, with no schema in
 *     sight: column names from `find`, entity/tx/op positions, aggregate
 *     result types, arithmetic outputs, fts hits — value positions type as
 *     `Value`, because value types are schema knowledge and queries don't
 *     know the schema on purpose. Where more precision is wanted, declare
 *     it: annotate the same plain object as `Query<R, I>` — trusted, not
 *     proven, the sql<Row>`…` bargain. Schema-aware correctness (does this
 *     attr exist, is it fulltext) is a RUNTIME concern by design, checked
 *     by the engine on every read (`QueryError`) and available as a pure
 *     preflight (`checkQuery` in SUGAR). Structure is compile-time and
 *     schema-free; meaning is runtime and schema-aware — that line is the
 *     design. The one ordered read in the system, `Db.page` (with its raw
 *     sibling `Db.scan`), lives outside the query for a reason its note
 *     explains: it is not, and must never be, a sync unit.
 *
 *  Everything crossing this interface is data. No closures in queries, no
 *  opaque handles in results, and errors are data too — a `Query`, an
 *  `Op[]`, a `Footprint`, a `TxReport`, a `TxError` and a `QueryError` all
 *  serialize losslessly under one pinned wire encoding (`wireEncode` /
 *  `wireDecode`, defined in LEXICAL GROUND RULES), which is what makes goal
 *  3 possible at all. "Serializes to JSON" here always means "through that
 *  encoding": instants and bytes are tagged, everything else is bare.
 *  Types, inferred or declared, never cross the wire — they are claims
 *  about data, checked where the code is written, trusted where it runs.
 *
 *  DECISION LOG — settled questions, recorded so a reversal is deliberate
 *  rather than a merge accident:
 *   - Queries are application-independent plain objects. A schema-coupled
 *     inference layer (defineSchema / q() / sel() with compile-time
 *     unknown-attr and fulltext checks) was designed, built, and REMOVED
 *     by decision: it bound every query definition to a schema import.
 *     Schema-aware validation is runtime-only (checkQuery / checkPull /
 *     checkOps, and QueryError on every read); compile-time typing is
 *     structural and schema-free (QUERY TYPING).
 *   - TxId: a per-store numeric counter was replaced by the HLC-origin
 *     string, because multi-master ingest with preserved tx ids is
 *     incoherent without globally unique transaction identity.
 *   - unique 'identity' upsert: removed — there are no tempids to
 *     resolve, and redirecting client-minted ids is spooky action.
 *   - order / limit / offset inside Query: never — a limited query has
 *     no stable footprint; ordering lives on Db.page / Db.scan.
 *   - transaction functions: never — cas + onBasis cover the need and
 *     ops stay data.
 *   - relevance scores: never bound — a score is not a fact.
 *   - entity() without an id: removed — the minted id was unreachable.
 *   - Connection.origin is exposed (not hidden as an internal): sync
 *     policy is the caller's, and deciding what to push requires
 *     telling your own datoms from foreign ones.
 *
 * ============================================================================
 */

/**
 * ============================================================
 *  CORE VALUES
 * ============================================================
 */

/**
 * An entity id. Two forms exist, both plain strings:
 *
 *  - Minted ids: canonical lowercase UUIDv7 (36 chars, hyphenated).
 *    Clients mint their own with `newId` — there are no tempids, and
 *    therefore no upsert-by-tempid machinery anywhere in this API.
 *  - Transaction entity ids: the reserved form `tx-{TxId}` produced by
 *    `txEntity` and inverted by `txIdOf`. Never minted by `newId`.
 *
 * The brand is compile-time only; at runtime and on the wire an
 * EntityId is its string. No entity id ever starts with '?' or
 * contains '/', which is part of what makes the query grammar
 * unambiguous — see LEXICAL GROUND RULES.
 */
export type EntityId = string & { readonly __e: unique symbol };

/**
 * Namespaced attribute name, e.g. "person/name".
 *
 * Grammar (validated at transact and query time; violations reject
 * with 'unknown-attr' / 'malformed'): exactly one '/', a non-empty
 * namespace and name on either side, must not start with '?', and
 * must not collide with a clause head keyword (it cannot — head
 * keywords contain no '/'). Reserved to the engine: the namespaces
 * 'db/*', 'attr/*', 'excise/*', and the single attr 'tx/at'. The
 * rest of 'tx/*' is open on purpose — 'tx/author', 'tx/reason' and
 * friends are the intended provenance idiom (see TX). Reserved
 * attrs are queryable like any data; they are enumerated where they
 * are defined (SCHEMA for 'attr/*', TxReport for 'tx/at', excise
 * for 'excise/*') and are never redeclared by callers.
 */
export type Attr = string;

/**
 * Globally unique, totally ordered transaction id.
 *
 * A TxId is a fixed-width, lexicographically sortable string:
 *
 *   {12 hex chars: 48-bit physical ms}{4 hex chars: logical counter}
 *   '-'
 *   {8 hex chars: origin id of the minting store}
 *
 *   e.g. '018f2a3c5d7e0001-a1b2c3d4'
 *
 * Fixed width means plain string comparison IS the transaction
 * order: (time, counter, origin), the same on every peer. The
 * origin id is minted once at store creation, so two stores can
 * never produce the same TxId — which is what makes ingest's
 * "greater tx id wins" rule total (ties are impossible) and lets
 * `txEntity` be injective. Within one store, ids are strictly
 * increasing; `ingest` advances the local clock past every ingested
 * id, so transactions committed after an ingest always order after
 * the history they observed (hybrid logical clock semantics: the
 * order is causally consistent, and wall-clock consistent to the
 * extent peer clocks are sane).
 *
 * One origin is reserved: '00000000'. It is never assigned to a
 * store; it marks HYPOTHETICAL transactions — the ids `Db.with`
 * mints for datoms that were never committed anywhere. `ingest`
 * rejects any datom bearing it ('malformed'), so a hypothetical
 * fact can never leak into a real history (see `Db.with`).
 *
 * Callers never mint TxIds; the engine does, at commit. Callers
 * compare them with `<` and pass them to `asOf`/`since`/`log`/
 * `onBasis` — no arithmetic is meaningful on them.
 */
export type TxId = string & { readonly __tx: unique symbol };

/**
 * One total order is pinned over all values, so comparisons, scans,
 * page cursors and tie-breaks are deterministic on every peer:
 *
 *   type order:   boolean < number < instant < string < bytes
 *   boolean:      false < true
 *   number:       IEEE-754 numeric order; only finite doubles are
 *                 legal values (NaN and ±Infinity reject with
 *                 'type-mismatch'; -0 is normalized to 0)
 *   instant:      by epoch milliseconds
 *   string:       by Unicode code point
 *   bytes:        lexicographic by byte
 *   ref:          orders and encodes as its string — an EntityId is
 *                 a string, and the brand is compile-time only
 *
 * Wire encoding: see `wireEncode` in LEXICAL GROUND RULES.
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

/**
 * Stable identity of a datom, for dedup and set membership. The key
 * covers all five fields — (e, a, v, tx, op) — because an assert and
 * a later retract of the same (e, a, v) are two distinct facts, and
 * `ingest`'s idempotence is defined over exactly this key.
 */
export function key(d: Datom): string;

/**
 * Reference an entity by a `unique` attribute instead of by id.
 * Resolves at transact/read time; an unresolvable lookup ref in a
 * write rejects the transaction, and in a read behaves as "no such
 * entity" (pull returns null; a pattern binds nothing).
 */
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
 *
 * TX's runtime value is the reserved nil UUID
 * '00000000-0000-0000-0000-000000000000'. `newId` can never mint it
 * (UUIDv7 version bits forbid it), and using it anywhere except the
 * entity position of an op inside `transact` rejects with
 * 'malformed' — it is a placeholder, not an entity.
 */
export declare const TX: EntityId;

/**
 * The entity id of a committed transaction: the reserved string
 * `tx-{t}`. `Datom.tx` is a TxId — an id, because ordering, `since`
 * and `log` need one — while joins need an entity id; this pure
 * function is the deterministic, injective bridge. Inside queries
 * the 4th pattern position already binds the entity id, so this
 * exists only for correlating raw datoms (from a Footprint or
 * `scan`) with their tx datoms in the caller.
 */
export function txEntity(t: TxId): EntityId;

/**
 * The inverse of `txEntity`: recover a TxId from a tx entity id, so
 * a transaction *found by query* (the 4th pattern position binds tx
 * entity ids) can be fed back into `asOf`, `since`, `log` or
 * `onBasis`. Returns null for any id that is not a tx entity id.
 * Pure — the encoding is invertible by construction.
 */
export function txIdOf(e: EntityId): TxId | null;

/**
 * ============================================================
 *  LEXICAL GROUND RULES
 * ============================================================
 * The disambiguation and encoding rules everything else stands on.
 * They are normative: the engine validates them and rejects
 * violations as data ('malformed' in QueryError / TxError), never
 * silently reinterprets. The structural typing in QUERY TYPING
 * reads the same rules at compile time; runtime validation remains
 * the authority, because wire-decoded queries never met a compiler.
 *
 * TOKEN CLASSES. Every string in a query or op belongs to exactly
 * one class, decidable from the string alone:
 *
 *   Var        starts with '?', at least one char after it
 *   Attr       contains exactly one '/', does not start with '?'
 *   EntityId   canonical UUIDv7, the nil UUID (TX), or 'tx-…'
 *   keyword    one of the reserved clause/op heads:
 *              '+' '-' 'cas' 'schema' '=' '!=' '<' '<=' '>' '>='
 *              're' 'fts' 'not' 'rule' '*' '/' 'lit'
 *   Value      any other string is a plain string value
 *
 * These classes are disjoint by construction (keywords contain no
 * '/', don't start with '?', and aren't UUIDs), so a clause is
 * decidable from its head token even after a JSON round trip, with
 * one precedence rule: a tuple whose first element is a keyword is
 * that keyword's clause form, never a pattern. This is why patterns
 * need no tag while 'rule', 're', 'fts', 'not', comparison and
 * arithmetic clauses are all head-tagged. The type-level walker in
 * QUERY TYPING discriminates clauses by exactly this rule.
 *
 * STRING VALUES THAT LOOK LIKE VARS. A string literal beginning
 * with '?' written directly in a clause always parses as a Var.
 * To match such a value, bind it through `in`/inputs — inputs are
 * values by definition and are never re-parsed:
 *
 *   in: { odd: '?needle' }, where: [['?e','note/title','?needle']]
 *   inputs: { odd: '?help' }        // matches the title "?help"
 *
 * There is deliberately no literal-escape form in the clause
 * grammar itself; inputs are the escape hatch, and they are always
 * available.
 *
 * WIRE ENCODING. The one pinned JSON encoding for everything that
 * crosses a process boundary — queries, ops, datoms, footprints,
 * reports, errors, input maps:
 *
 *   string / boolean / finite number   bare
 *   Date (instant)                     { "$t": "2024-01-15T12:00:00.000Z" }
 *   Uint8Array (bytes)                 { "$b": "<base64>" }
 *   EntityId / TxId / Attr / Var       bare strings (brands are
 *                                      compile-time; datom value
 *                                      types are recovered from
 *                                      schema on decode)
 *   tuples / arrays / records          structural, values encoded
 *                                      recursively
 *
 * No Value is ever a plain object, so the `$t`/`$b` tags cannot
 * collide with data. `wireEncode`/`wireDecode` below implement
 * exactly this; a peer in another language must implement the same
 * table or footprints lie.
 */

/** Encode any API value/container to plain JSON per the table above. */
export function wireEncode(x: unknown): unknown;
/** Inverse of `wireEncode`. Throws QueryRejected {code:'malformed'} on unrecognized tags. */
export function wireDecode(x: unknown): unknown;

/**
 * ============================================================
 *  SCHEMA
 * ============================================================
 * Schema is stored as datoms like everything else, so it
 * time-travels and syncs. This is just the shape you transact.
 *
 * Where it lives: each declared attr is an entity carrying the
 * reserved attrs 'attr/name', 'attr/type', 'attr/card',
 * 'attr/unique', 'attr/component', 'attr/index', 'attr/from',
 * 'attr/fulltext', 'attr/noHistory' — so schema is queryable like
 * any data (['?a', 'attr/name', '?name']), and `Db.schema()` is
 * mere sugar over that read. One encoding note: a Derive is a
 * tuple, not a Value, so 'attr/from' holds it wire-encoded as its
 * JSON string.
 *
 * Schema is RUNTIME knowledge, on purpose. Queries never import it
 * and never reference it — they are plain, application-independent
 * objects (goal 4) — so "does this attr exist", "is it fulltext",
 * "is it indexed" are questions the ENGINE answers, on every read,
 * as QueryError data. `checkQuery` / `checkPull` / `checkOps`
 * (SUGAR) expose the same judgment as a pure preflight, which is
 * how a sync endpoint validates a wire query before running it,
 * and how an app surfaces a typo'd attr at startup instead of
 * first use. `schemaDrift` (SUGAR) is the deploy guard: it diffs
 * the schema constant a build shipped with against the live store,
 * because declared row/tree types are static claims and a live
 * card 'one' → 'many' migration changes result shapes (scalar →
 * array) out from under them.
 *
 * Re-transacting an attr is a migration, and only widenings are
 * accepted: card 'one' → 'many', adding `index`, adding `noHistory`,
 * and adding `unique` when no existing values collide. Everything
 * else — a type change, 'many' → 'one', adding `unique` to an attr
 * whose existing values already collide — is rejected with
 * 'schema-incompatible'. A narrowing is a new attr. A schema op may
 * share a transaction with data ops, and later ops in that same
 * transaction may use the attrs it declares.
 *
 * Composite uniqueness (SQL's UNIQUE(a, b)) is a derived attr:
 *
 *   'member/key': { type: 'string', unique: true,
 *                   from: ['concat', 'member/user', '|', 'member/group'] }
 *
 * The engine maintains the key in the same transaction as its
 * components, so it cannot drift and no caller ever writes it —
 * what used to be transaction discipline here is now a declaration.
 * The same mechanism carries case-insensitive collation and
 * compound sort keys; see `from` below.
 *
 * Also absent, on purpose:
 *
 *   NOT NULL, foreign keys, CHECK. Entities are open attribute
 *   bags, and `ingest` applies remote facts without re-checking
 *   constraints, so global referential integrity is unenforceable
 *   in a system that syncs — an engine that promised it would be
 *   lying on every peer but one. What replaces them: cascade is
 *   `component`; single-fact invariants are `cas`; multi-fact
 *   invariants are `onBasis`; required-ness is validated in the
 *   caller before transact and auditable after the fact by query —
 *   ['not', ['?e', 'required/attr', '?v']] finds every violator.
 *
 *   Upsert-on-unique-conflict. Earlier drafts had Datomic's
 *   unique 'identity'; it was cut because identity-upsert exists to
 *   resolve *tempids*, and this API has none — every id a caller
 *   writes is a concrete id the caller minted, and silently
 *   redirecting a transaction's assertions from a freshly minted id
 *   onto some existing entity would be spooky action on a value the
 *   caller owns. The replacements are explicit: address the
 *   existing entity with a LookupRef when you mean it, or catch
 *   'unique-conflict' — whose payload names the `holder` — and
 *   redirect deliberately.
 */

export interface AttrSpec {
  type: 'string' | 'number' | 'boolean' | 'instant' | 'bytes' | 'ref';
  /** default 'one' */
  card?: 'one' | 'many';
  /**
   * At most one live assertion of each value across all entities.
   * A colliding assert in `transact` rejects with 'unique-conflict'
   * (the error carries the current `holder`, so redirecting is the
   * caller's one-catch decision). `ingest` does not re-check — see
   * Connection.ingest for how concurrent unique claims resolve.
   * Unique attrs are usable in LookupRefs and are implicitly AVET-
   * indexed (no separate `index: true` needed).
   */
  unique?: true;
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
  /**
   * Keep only the current value; drop prior values from the indexes.
   * Four interactions, pinned:
   *  - `asOf` / `history`: the indexes retain only the latest value,
   *    so any basis shows at most that value and `history()` carries
   *    no assert/retract trail for this attr. Past reads of it are
   *    best-effort by design — do not put audited data here.
   *  - `TxReport` / `log` / footprint deltas: UNAFFECTED. Reports are
   *    the record of change and still carry every assert and retract
   *    at write time; `noHistory` prunes indexes, never the log.
   *  - `ingest`: an older foreign datom resolves by the usual
   *    greater-tx-wins rule and is then subject to the same pruning —
   *    nothing is resurrected.
   *  - `since` Dbs see a change iff it is the retained latest value
   *    and postdates the bound.
   */
  noHistory?: boolean;
}

/**
 * A derived attribute's computation: pure, deterministic, and data,
 * evaluated over the entity's own attrs. Three functions cover the
 * collation, composite-key and date-bucketing needs that SQL meets
 * with expressions; anything richer belongs in the caller, as a
 * plain attr it computes and owns.
 *
 * Source typing is checked at schema time ('schema-incompatible'):
 * 'lower' takes one string attr; 'trunc' takes one instant attr;
 * 'concat' takes string and ref attrs — a ref stringifies as
 * exactly its id string (the one pinned stringification; no other
 * type coerces to string, by design, so footprints can't drift on
 * formatting).
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
  /**
   * Compare-and-set, for optimistic concurrency on a single fact.
   * `expected: null` means "assert iff currently absent";
   * `next: null` means "retract iff still `expected`" — so both
   * directions of a guarded transition are expressible at fact
   * granularity. (Both null is 'malformed'.) card-one attrs only.
   */
  | readonly ['cas', Ref, Attr, Value | null, Value | null]
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
 * so it serializes under the pinned encoding (`at` travels as an
 * instant tag). The snapshots either side of a transaction are
 * derivable — asOf(tx), and asOf of the tx before it — so they are
 * not carried. `at` is also asserted by the engine as a datom on the
 * tx entity, under the reserved attr 'tx/at': that is what lets
 * asOf(Date) resolve against ingested history, and lets queries join
 * on time like any value.
 */
export interface TxReport {
  tx: TxId;
  at: Date;
  /** exactly what changed — this is what you ship upstream */
  datoms: Datom[];
}

/**
 * Everything that can go wrong at commit, as data. `transact`,
 * `ingest` and `excise` reject with a `TxRejected` whose `reason`
 * is one of these; being JSON (under the pinned encoding), a
 * rejection crosses a process boundary intact, which matters when
 * the transactor is on the other end of a wire.
 */
export type TxError =
  | {
      code: 'unique-conflict';
      attr: Attr;
      value: Value;
      /** the entity currently holding the value — catch and redirect deliberately */
      holder: EntityId;
    }
  | {
      code: 'cas-failed';
      e: EntityId;
      a: Attr;
      expected: Value | null;
      actual: Value | null;
    }
  | {
      code: 'basis-moved';
      expected: TxId;
      actual: TxId;
    }
  | {
      code: 'type-mismatch';
      attr: Attr;
      value: Value;
    }
  | {
      code: 'unknown-attr';
      attr: Attr;
    }
  | {
      code: 'derived-attr';
      attr: Attr;
    }
  | {
      code: 'schema-incompatible';
      attr: Attr;
      reason: string;
    }
  /** grammar violations: malformed op shape, TX outside transact, reserved attr write, bad lookup ref, hypothetical-origin datom in ingest, … */
  | {
      code: 'malformed';
      detail: string;
    }
  /** the Connection has been closed; no further writes are possible */
  | {
      code: 'closed';
    };

export class TxRejected extends Error {
  /**
   * The first failure in op order — deterministic, so retry loops
   * and wire clients see the same error for the same ops. A
   * transaction either commits whole or reports its first problem;
   * there is no partial application and no error list to merge.
   */
  readonly reason: TxError;
}

/**
 * Everything that can go wrong on the read path, as data, with the
 * same JSON discipline as TxError — queries cross wires by design,
 * so their failures must too. `query`, `datoms`, `page`, `pull`,
 * `pullMany` reject with a `QueryRejected`; `scan` surfaces one on
 * its first `next()`. These are the schema-aware half of the typing
 * story (goal 4): compile-time types are structural and schema-free,
 * so EVERY schema-dependent mistake — unknown attr, non-fulltext fts
 * target, unindexed scan — is caught here, at runtime, for local and
 * wire-decoded queries alike. `checkQuery` (SUGAR) raises the same
 * judgments as a pure preflight.
 */
export type QueryError =
  | { code: 'unknown-attr'; attr: Attr }
  /** scan('avet', …) or an AVET-requiring plan over an attr lacking `index`/`unique` */
  | { code: 'not-indexed'; attr: Attr }
  /** scan('vaet', …) over a non-ref attr */
  | { code: 'not-a-ref'; attr: Attr }
  /** 'fts' clause over an attr not declared `fulltext` */
  | { code: 'not-fulltext'; attr: Attr }
  | { code: 'unknown-rule'; rule: string }
  /** a var unbound where a binding is required: arithmetic inputs, 're' subject, negation safety */
  | { code: 'unbound'; var: Var }
  /** recursion through negation */
  | {
      code: 'unstratifiable';
      rule: string;
    }
  /** grammar violations after a JSON round trip: bad clause shape, bad token class, bad selector */
  | {
      code: 'malformed';
      detail: string;
    }
  /** missing input, scalar/collection mismatch, or wrong value type for a binding */
  | {
      code: 'bad-input';
      name: string;
      detail: string;
    }
  | {
      code: 'bad-regex';
      pattern: string;
    }
  /** page `by`/`after` addressed a `collect` column at runtime (the type system prevents it statically) */
  | {
      code: 'unorderable-column';
      column: string;
    }
  /** pull/pullMany against history() — a card-one attr has many values across time; there is no one tree */
  | {
      code: 'unsupported-on-history';
      op: 'pull' | 'pullMany';
    }
  /** datoms() against a with() Db — hypothetical facts are not a sync unit; see Db.with */
  | {
      code: 'unsupported-on-hypothetical';
      op: 'datoms';
    }
  /** the Connection has been closed; no further reads are possible */
  | {
      code: 'closed';
    };

export class QueryRejected extends Error {
  readonly reason: QueryError;
}

/**
 * ============================================================
 *  QUERY  (datalog)
 * ============================================================
 * A query is a PLAIN OBJECT — no constructor, no builder, no schema
 * import, no function call to define one. The literal you write is
 * the value that runs, syncs via `datoms`, pages via `page`,
 * live-updates via `watch`, and crosses the wire via `wireEncode`.
 * Queries are deliberately independent of any application schema:
 * they name attrs as strings and learn everything else at runtime.
 *
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
 *   literal       → strings starting with '?' can't be written as
 *   escape           clause literals (they parse as vars); bind them
 *                    through inputs, which are never re-parsed —
 *                    see LEXICAL GROUND RULES
 *   schema        → none, by design: attr existence, fulltext-ness
 *   coupling         and index-ness are runtime questions the engine
 *                    answers (QueryError / checkQuery); a query never
 *                    imports the application's schema
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

/** '?' followed by at least one character — see LEXICAL GROUND RULES */
export type Var = `?${string}`;
export type Term = Var | Value;

/** one named argument: a scalar for a `Var` binding, a list for `[Var]` */
export type Input = Value | readonly Value[];
/**
 * The shape a query's arguments come in as: an object keyed by the
 * names in `in`. A scalar cell binds a Var; a list cell binds
 * `[Var]`. As a bare type this is the OPEN shape — parameter names
 * unknown statically, the type of every wire-decoded query's inputs.
 */
export type InputShape = Record<string, Input>;
/** alias — a query's arguments, one entry per name in its `in` */
export type InputMap = InputShape;

/** `collect` yields many values in one cell; every other cell is scalar */
export type Cell = Value | readonly Value[];

/**
 * The keys of R whose cells are scalar `Value`s — i.e. every column
 * except `collect` columns. This is what `page.by` accepts, and the
 * set the tie-break order and `after`-cursor equality are defined
 * over, because the pinned total order covers Values, not arrays.
 * It is always sufficient: rows are grouped by their non-aggregate
 * (scalar) entries, so any two distinct rows already differ on a
 * scalar column. String-index keys (an open RowShape) are skipped
 * so an unknown row type cannot collapse this to `never`.
 */
export type ScalarKeys<R extends RowShape> = {
  [K in keyof R]: string extends K
    ? never
    : R[K] extends Value
      ? K & string
      : never;
}[keyof R];

/**
 * The shape a query's rows come back in: an object per row. As a
 * bare type this is the OPEN shape — column names unknown, every
 * cell a Cell — which is what a wire-decoded query's rows are until
 * the caller declares better. Rows and inputs are objects, so order
 * is meaningless and consumption is by name, not position.
 */
export type RowShape = Record<string, Cell>;

/** the empty input shape: a query that takes no arguments */
export type NoInputs = Record<never, never>;

/**
 * The three statically distinguishable input situations, derived
 * from I alone. Everything arity-related keys off this:
 *
 *   'named'  I lists concrete parameter names → inputs REQUIRED,
 *            typed as I.
 *   'none'   I is NoInputs → inputs FORBIDDEN.
 *   'open'   I is the open InputShape — a wire-decoded or otherwise
 *            statically unknown query → inputs OPTIONAL, typed as
 *            InputMap. This case exists so footprint replay
 *            (`db.query(fp.query, fp.inputs)`) compiles: a query
 *            whose parameters are unknown must still accept them.
 */
export type InputsMode<I extends InputShape> = string extends keyof I
  ? 'open'
  : keyof I extends never
    ? 'none'
    : 'named';

/** the inputs argument for `Db.query`, per mode */
export type InputsArg<I extends InputShape> = {
  named: [inputs: I];
  none: [];
  open: [inputs?: InputMap];
}[InputsMode<I>];

/**
 * The `in` declaration for one input cell: a bare Var for a scalar
 * Input, `[Var]` for a collection Input.
 */
export type InElem<V extends Input> = V extends readonly Value[]
  ? readonly [Var]
  : Var;

/**
 * Named parameters, bound by key from the `inputs` map — names, not
 * positions, for the same reason `find` is a record: two arguments of
 * the same type can never be silently swapped, and a Footprint's
 * echoed inputs read as what they are. A bare Var binds a scalar;
 * `['?x']` binds a collection — the query runs as if unioned over its
 * elements. A static list is derivable (one rule body per member),
 * but a runtime list — "these 50 ids", the commonest parameter shape
 * in a product app — would force rewriting the query per call, and a
 * query whose shape changes per call is useless as a reusable sync
 * unit. So this one earns its place. A missing or shape-mismatched
 * argument rejects with QueryRejected {code:'bad-input'}.
 */
type QueryIn<I extends InputShape> = {
  named: {
    readonly in: { readonly [K in keyof I]: InElem<I[K] & Input> };
  };
  none: { readonly in?: undefined };
  open: { readonly in?: Record<string, Var | readonly [Var]> };
}[InputsMode<I>];

/**
 * A typed query. Structurally this is exactly `QuerySource` — a
 * plain object, and the ONLY runtime shape a query has — plus one
 * phantom property, '~', that exists purely in the type system to
 * carry R and I (it is optional, never present at runtime, never
 * written, never encoded). Two doors produce this type:
 *
 *   declared   annotate the plain object: `const Q: Query<R, I> =
 *              {…}`. R and I are the author's claim — trusted, not
 *              proven — and `find`/`in` keys are still compiler-
 *              checked against them. This is the door for precise
 *              value types and the only door for wire-decoded or
 *              runtime-assembled queries (whose type is the open
 *              `Query` — both generics defaulted to their open
 *              shapes).
 *
 *   inferred   pass the plain object (kept literal with `as const`)
 *              straight to `Db.query`/`datoms`/`page`/`watch`; the
 *              call site infers what the query TEXT proves — see
 *              QUERY TYPING. No annotation, no import, no wrapper.
 *
 * Both doors hold the same plain object; the type is the only
 * difference, which is goal 4's "inference is a convenience of
 * authorship, never a second kind of query."
 */
export type Query<
  R extends RowShape = RowShape,
  I extends InputShape = InputShape,
> = {
  /**
   * Projection: one entry per column of R. A bare Var projects its
   * binding; [Agg, Var] aggregates it. Grouping is implicit — every
   * non-aggregate entry — and because output columns are named by
   * their key, min and max of the same var no longer collide:
   * { fastest: ['min','?t'], slowest: ['max','?t'] }.
   */
  find: { readonly [K in keyof R]: FindElem };
  where: readonly Clause[];
  /**
   * Kept in the tuple during aggregation but not projected. The only
   * way to opt out of set semantics — without it, `sum` over two
   * entities that happen to share a value counts that value once.
   */
  with?: readonly Var[];
  /** a name may have several bodies; that is how disjunction is written */
  rules?: Record<string, readonly Rule[]>;
  /** phantom type carrier — never present at runtime; see doc above */
  readonly '~'?: { rows: R; inputs: I };
} & QueryIn<I>;

export type FindElem = Var | readonly [Agg, Var];

/**
 * `collect` returns the group's values in one cell — as a set, in
 * the pinned value order (deterministic, but carrying no meaning:
 * treat it as unordered). It is the escape hatch: median, stddev,
 * top-n and string joining are all derived from it in the caller,
 * so they are not aggregates here. A `collect` column cannot be a
 * `page` sort key — see `ScalarKeys`.
 */
export type Agg = 'count' | 'sum' | 'min' | 'max' | 'collect';

/** [params, ...body] */
export type Rule = readonly [readonly Var[], ...Clause[]];

/**
 * Clause discrimination is purely lexical and survives JSON round
 * trips: a tuple whose head is a reserved keyword is that keyword's
 * form; anything else is a pattern. This works because token
 * classes are disjoint — see LEXICAL GROUND RULES. A tuple that
 * fits no form rejects with {code:'malformed'}.
 */
export type Clause =
  /**
   * Pattern — the only way to read a datom. Repeated vars join.
   * Optional 4th and 5th positions bind a datom's provenance: the
   * 4th binds its transaction — as the tx *entity* id, so it joins
   * straight onto tx datoms like 'tx/author' (and round-trips to a
   * TxId via `txIdOf`) — and the 5th binds `op`, meaningful only
   * against a `history()` db. Without these, "who changed what,
   * when" is unaskable; with them, audit is a join, not an API.
   */
  | readonly [Var | Ref, Attr | Var, Term]
  | readonly [Var | Ref, Attr | Var, Term, Var]
  | readonly [Var | Ref, Attr | Var, Term, Var, Var]
  /**
   * Comparison. All six are derivable from '<', '=' and `not`, but
   * they are one concept, so they are spelled six ways. Compares in
   * the pinned value order, across types included.
   */
  | readonly [Cmp, Term, Term]
  /**
   * Regex — the one string predicate. ['re', '?v', pattern]. The
   * pattern is a Term, so it binds from `inputs` like any value —
   * which is what lets a search query stay one static object across
   * keystrokes instead of being rebuilt per needle. Runtime needles
   * must be escaped (`escapeRe`) and anchored by the caller; the
   * regex dialect, like the fts analyzer, is pinned and versioned so
   * peers match identically. An invalid pattern rejects with
   * {code:'bad-regex'}.
   */
  | readonly ['re', Term, Term]
  /**
   * Full-text search — a generator, like a pattern: binds ?e (and
   * optionally the matched value) for every entity whose `a` matches
   * the query string. `a` must be literal and declared `fulltext`
   * ({code:'not-fulltext'} otherwise — a runtime judgment, since
   * queries don't know the schema).
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
   * EXISTS. Head-tagged like every non-pattern clause because a
   * 3-arity call is otherwise a pattern.
   */
  | readonly ['rule', string, ...Term[]];

export type Cmp = '=' | '!=' | '<' | '<=' | '>' | '>=';
export type Arith = '+' | '-' | '*' | '/';

/**
 * A pull selector: which attrs to read and which refs to follow,
 * for `Db.pull`. A plain object like a query, and like a query it
 * never references the schema. Deliberately zero query power — no
 * predicates, no joins beyond following a ref, no aggregation —
 * which is what keeps datalog the only query language: a selector
 * cannot *find* anything, only shape entities already found.
 *
 *   ['note/title', 'note/tag',            // attrs; card-many → array
 *    { 'note/folder': ['folder/name'] },  // follow a ref into a subtree
 *    { 'comment/_note': ['comment/text'] }] // '_' walks the ref backwards
 *
 * '*' selects every current attr (refs as ids); '...' as a subtree
 * recurs with the enclosing selector, which is how a folder chain or
 * a component tree is read to any depth. Recursion over a cycle
 * terminates by returning the already-visited entity as its id.
 *
 * PRESENCE, pinned: an attr the entity does not have is OMITTED from
 * the result — no null placeholder, for any kind of entry (scalar,
 * card-many, forward or reverse ref). Entities are open bags, so
 * absence is normal; declared tree types should make every property
 * optional. Present card-many attrs and reverse refs are non-empty
 * arrays. Only the pull of a nonexistent entity is `null`, at the
 * top level.
 *
 * TREE TYPES ARE DECLARED, not inferred, and the reason is pinned:
 * whether a followed attr yields one subtree or an array of subtrees
 * is cardinality — schema knowledge — and selectors don't know the
 * schema. A schema-free inference would type every leaf and branch
 * as scalar-or-array unions, which helps no one; declare T on the
 * `pull` call (trusted, not proven), and preflight the selector
 * against a schema at runtime with `checkPull` when it matters.
 */
export type Pull = readonly (
  | Attr // 'ns/name', or 'ns/_name' reversed
  | '*'
  | { readonly [a: Attr]: Pull | '...' }
)[];

/**
 * ============================================================
 *  QUERY TYPING  (structural, schema-free, zero imports)
 * ============================================================
 * Everything in this section is compile-time only, and none of it
 * is required to write or run a query: a query is a plain object,
 * full stop. What this section defines is what the type system can
 * prove about that object FROM ITS TEXT ALONE — no schema, no
 * constructor, no wrapper function. The inference activates at the
 * `Db` call sites (`query`, `datoms`, `page`) and `watch`: pass a
 * literal query (kept literal with `as const`, or written inline)
 * and the result rows and required inputs are computed from it.
 *
 * Three laws:
 *
 *  1. ONE SHAPE, TWO DOORS. Inferred and declared queries are the
 *     same runtime object and flow through the same signatures; the
 *     phantom '~' on `Query<R, I>` is how a declaration overrides
 *     inference at the call site, and its absence is how inference
 *     applies. If the two doors ever disagree about the same text,
 *     inference is the bug.
 *
 *  2. THE TEXT PROVES STRUCTURE; ONLY THE SCHEMA PROVES MEANING.
 *     What the text alone establishes is typed precisely: an
 *     entity/tx position is EntityId, an op binding is boolean, an
 *     arithmetic output is number, an fts hit is string, count/sum
 *     are number, collect is an array, and rule arguments take the
 *     union of their per-body types (depth-limited, below). A VALUE
 *     position types as `Value` — its real type lives in the schema,
 *     which queries do not know BY DESIGN; declare `Query<R, I>`
 *     when you want it narrower. Nothing schema-dependent is a
 *     compile error, ever: unknown attrs, non-fulltext fts targets
 *     and the like are runtime judgments (QueryError, `checkQuery`).
 *     The only compile errors are the three lexical checks in
 *     `ValidateQuery`, each catching a query that is certainly
 *     wrong from its text alone.
 *
 *  3. DEGRADE, DON'T FAIL. Whatever the walker cannot read — a
 *     widened (non-`as const`) query, a wire-decoded query, a var
 *     in the attribute position, recursion past the depth budget —
 *     degrades to the open shapes (`Value`, `RowShape`, optional
 *     `InputMap`), never to a compile error and never to a blocked
 *     call. Forgetting `as const` costs precision, not compilation;
 *     the lexical checks skip themselves on any query too widened
 *     to judge (see the gates in `ValidateQuery`).
 *
 * Rule inference is depth-limited (three invocations deep):
 * recursion is common and an unbounded type-level walk of recursive
 * rules is where TypeScript instantiation limits live. Within the
 * budget, a rule argument's type is the union, across the rule's
 * bodies, of the matching parameter's inferred type in that body;
 * past it, the argument degrades to `Value` per law 3.
 *
 * Requires TypeScript >= 5.0; this section may track TypeScript
 * releases, so it is versioned as the package's `/typed` entry
 * point while everything above stays frozen with the wire.
 */

/** bind one var to a type; non-vars bind nothing */
type Bind<V, T> = V extends Var ? { readonly [K in V]: T } : unknown;

/**
 * Join-merge two environments: a var bound in both intersects,
 * because unification means the value satisfies both positions
 * (EntityId & Value = EntityId — a var used anywhere as an entity
 * is an EntityId everywhere). A var joined across contradictory
 * positions infers `never`, a compile-time smell that the query can
 * never match, surfaced without a special check.
 */
type MergeEnv<A, B> = {
  readonly [K in keyof A | keyof B]: (K extends keyof A ? A[K] : unknown) &
    (K extends keyof B ? B[K] : unknown);
};

/**
 * Environment of one pattern clause — schema-free: e → EntityId,
 * a → Attr (when a var), v → Value (value types are schema
 * knowledge), tx → EntityId, op → boolean.
 */
type PatternEnv<C> = C extends readonly [
  infer E,
  infer A,
  infer V,
  ...infer Extra,
]
  ? MergeEnv<
      MergeEnv<Bind<E, EntityId>, MergeEnv<Bind<A, Attr>, Bind<V, Value>>>,
      Extra extends readonly [infer T4, infer T5]
        ? MergeEnv<Bind<T4, EntityId>, Bind<T5, boolean>>
        : Extra extends readonly [infer T4]
          ? Bind<T4, EntityId>
          : unknown
    >
  : unknown;

/** depth budget for rule-body inference — three invocations */
type DefaultDepth = readonly [0, 0, 0];
type Shorter<D> = D extends readonly [unknown, ...infer R] ? R : readonly [];

/** rule args past the budget or naming an unknown rule degrade to Value */
type DegradeArgs<Args> = Args extends readonly [infer A, ...infer Rest]
  ? MergeEnv<Bind<A, Value>, DegradeArgs<Rest>>
  : unknown;

/** zip a call's args against one body's params, binding each var arg to its param's type in that body */
type ZipArgs<Args, Params, Env> = Args extends readonly [infer A, ...infer AR]
  ? Params extends readonly [infer P, ...infer PR]
    ? MergeEnv<
        Bind<A, P extends keyof Env ? Env[P] : Value>,
        ZipArgs<AR, PR, Env>
      >
    : unknown
  : unknown;

type ArgsEnvOfBody<Rs, B, Args, D> = B extends readonly [
  infer Params,
  ...infer Body,
]
  ? ZipArgs<Args, Params, ClausesEnv<Rs, Body, D>>
  : unknown;

/** across a rule's bodies (disjunction), an arg's type is the UNION of its per-body types */
type ArgsEnvOverBodies<Rs, Bodies, Args, D> = Bodies extends readonly [
  infer B,
  ...infer Rest,
]
  ? Rest extends readonly []
    ? ArgsEnvOfBody<Rs, B, Args, D>
    : UnionEnv<
        ArgsEnvOfBody<Rs, B, Args, D>,
        ArgsEnvOverBodies<Rs, Rest, Args, D>
      >
  : unknown;

type UnionEnv<A, B> = {
  readonly [K in keyof A & keyof B]: A[K] | B[K];
};

type RuleCallEnv<Rs, N, Args, D> = D extends readonly []
  ? DegradeArgs<Args>
  : N extends keyof Rs
    ? ArgsEnvOverBodies<Rs, Rs[N], Args, Shorter<D>>
    : DegradeArgs<Args>;

/**
 * Environment of one clause, discriminated by head token exactly as
 * the runtime grammar discriminates (LEXICAL GROUND RULES): keyword
 * heads first, pattern otherwise. `not` binds nothing outward, as
 * negation does at runtime.
 */
type ClauseEnv<Rs, C, D> = C extends readonly ['not', ...unknown[]]
  ? unknown
  : C extends readonly ['re', unknown, unknown]
    ? unknown
    : C extends readonly [Cmp, unknown, unknown]
      ? unknown
      : C extends readonly [Arith, unknown, unknown, infer Out]
        ? Bind<Out, number>
        : C extends readonly ['fts', infer E, Attr, unknown, infer Hit]
          ? MergeEnv<Bind<E, EntityId>, Bind<Hit, string>>
          : C extends readonly ['fts', infer E, Attr, unknown]
            ? Bind<E, EntityId>
            : C extends readonly ['rule', infer N, ...infer Args]
              ? RuleCallEnv<Rs, N, Args, D>
              : PatternEnv<C>;

/** fold a conjunction's clause environments with join-merge */
type ClausesEnv<Rs, Cs, D> = Cs extends readonly [infer C, ...infer Rest]
  ? MergeEnv<ClauseEnv<Rs, C, D>, ClausesEnv<Rs, Rest, D>>
  : unknown;

/**
 * The plain-object grammar of a query — what every query IS at
 * runtime, and, not coincidentally, exactly what `wireDecode`
 * yields for one. `Query<R, I>` is this plus a phantom.
 */
export interface QuerySource {
  readonly find: Record<string, FindElem>;
  readonly in?: Record<string, Var | readonly [Var]>;
  readonly where: readonly Clause[];
  readonly with?: readonly Var[];
  readonly rules?: Record<string, readonly Rule[]>;
}

/** every binding the query's own text establishes */
export type QueryEnv<Q extends QuerySource> = ClausesEnv<
  Q extends { rules: infer Rs } ? Rs : unknown,
  Q['where'],
  DefaultDepth
>;

/** a var's type in an environment; unbound degrades to Value (law 3) */
type LookupVar<Env, V> = V extends keyof Env ? Env[V] : Value;

/** the row type the text proves: one column per `find` entry */
export type InferRows<Q extends QuerySource> = {
  readonly [K in keyof Q['find']]: Q['find'][K] extends readonly ['count', Var]
    ? number
    : Q['find'][K] extends readonly ['sum', Var]
      ? number
      : Q['find'][K] extends readonly ['min' | 'max', infer V]
        ? LookupVar<QueryEnv<Q>, V>
        : Q['find'][K] extends readonly ['collect', infer V]
          ? readonly LookupVar<QueryEnv<Q>, V>[]
          : LookupVar<QueryEnv<Q>, Q['find'][K]>;
};

/**
 * The input shape the text proves: parameter names from `in`, each
 * typed by what the clauses demand of its var (usually `Value` —
 * schema-free — but EntityId for entity positions, string for fts
 * needles used as patterns, and so on). A query with no literal
 * `in` and a literal `find` proves NoInputs; a widened query proves
 * the open InputShape, which is what keeps footprint replay
 * compiling (see InputsMode 'open').
 */
export type InferInputs<Q extends QuerySource> = Q extends {
  readonly in: infer In extends Record<string, Var | readonly [Var]>;
}
  ? string extends keyof In
    ? InputShape // widened `in`: names unknown → open
    : {
        readonly [K in keyof In]: In[K] extends readonly [infer V]
          ? readonly LookupVar<QueryEnv<Q>, V>[]
          : LookupVar<QueryEnv<Q>, In[K]>;
      }
  : string extends keyof Q['find']
    ? InputShape // widened query altogether: unknown → open
    : NoInputs;

/**
 * Resolve a query value's row type at a call site: the phantom '~'
 * (a declaration) wins when present; otherwise the text is walked.
 * A widened query resolves to the open RowShape either way.
 */
/**
 * Resolve a query value's row type at a call site: the phantom '~'
 * (a declaration) wins when present; otherwise the text is walked.
 * A widened query resolves to the open RowShape either way.
 *
 * The tuple wrapping and `NonNullable` are load-bearing, not style.
 * '~' is OPTIONAL, so `infer T` picks up `{…} | undefined`, and a
 * naked type parameter in a check position DISTRIBUTES — without
 * these the declared type would union with the inferred one
 * (`R | InferRows<Q>`) instead of overriding it. `NonNullable` drops
 * the undefined arm; the tuple stops distribution.
 */
export type RowsFor<Q extends QuerySource> = Q extends {
  readonly '~'?: infer T;
}
  ? [NonNullable<T>] extends [{ rows: infer R extends RowShape }]
    ? R
    : InferRows<Q> & RowShape
  : InferRows<Q> & RowShape;

/** the input-shape counterpart of RowsFor — same non-distributive shape, same reason */
export type InputsFor<Q extends QuerySource> = Q extends {
  readonly '~'?: infer T;
}
  ? [NonNullable<T>] extends [{ inputs: infer I extends InputShape }]
    ? I
    : InferInputs<Q>
  : InferInputs<Q>;

/** the vars a `find` projects bare */
type BareFindVars<Q extends QuerySource> = Extract<
  Q['find'][keyof Q['find']],
  Var
>;

/** the vars a `find` aggregates */
type AggFindVars<Q extends QuerySource> = {
  [K in keyof Q['find']]: Q['find'][K] extends readonly [Agg, infer V]
    ? V
    : never;
}[keyof Q['find']];

/** all projected vars */
type FindVars<Q extends QuerySource> = BareFindVars<Q> | AggFindVars<Q>;

/** the vars `in` binds */
type InVars<Q extends QuerySource> = Q extends {
  readonly in: infer In extends Record<string, Var | readonly [Var]>;
}
  ? In[keyof In] extends infer E
    ? E extends Var
      ? E
      : E extends readonly [infer V]
        ? V
        : never
    : never
  : never;

/**
 * A var that is aggregated AND projected bare is a group key being
 * aggregated within its own group: count is always 1, sum/min/max
 * echo the value — constant per row, certainly not what was meant.
 * A non-empty `with` restores multiplicity and is the escape.
 */
type DegenerateAggVars<Q extends QuerySource> = Q extends {
  with: readonly [Var, ...Var[]];
}
  ? never
  : Extract<AggFindVars<Q>, BareFindVars<Q>>;

/**
 * The three lexical compile checks — the ONLY compile errors in the
 * system (law 2), each catching a query that is certainly wrong
 * from its text alone, no schema needed:
 *
 *  1. a `find` var bound nowhere → a silently empty column;
 *  2. an `in` var used nowhere → a dead parameter;
 *  3. an aggregate over a var also projected bare, with no `with`
 *     → constant per row (count is always 1).
 *
 * Applied at the Db call sites and `watch` via `q: Q &
 * ValidateQuery<Q>` — plain objects have no definition-site hook,
 * so the error surfaces where the query is used; a violation fails
 * assignability with the message as the missing property's name.
 * The gates up front make every check self-skipping on queries too
 * widened to judge (wire-decoded, non-`as const`, or hand-declared
 * `Query<R, I>` whose find is a mapped type): degraded queries are
 * never blocked (law 3).
 */
export type ValidateQuery<Q extends QuerySource> =
  string extends keyof Q['find']
    ? unknown // widened find: nothing to judge
    : number extends Q['where']['length']
      ? unknown // widened where: environment unknowable
      : [Var] extends [FindVars<Q>]
        ? unknown // non-literal find entries (declared door)
        : [Exclude<FindVars<Q>, keyof QueryEnv<Q> | InVars<Q>>] extends [never]
          ? [Exclude<InVars<Q>, keyof QueryEnv<Q> | FindVars<Q>>] extends [
              never,
            ]
            ? [DegenerateAggVars<Q>] extends [never]
              ? unknown
              : {
                  'ERROR — aggregating a var that is also projected bare is constant per row (count is always 1); add a `with` clause or aggregate a different var': DegenerateAggVars<Q>;
                }
            : {
                'ERROR — in var is never used in where or find': Exclude<
                  InVars<Q>,
                  keyof QueryEnv<Q> | FindVars<Q>
                >;
              }
          : {
              'ERROR — find var is not bound by where, rules, or in': Exclude<
                FindVars<Q>,
                keyof QueryEnv<Q> | InVars<Q>
              >;
            };

/**
 * ============================================================
 *  DB — an immutable snapshot
 * ============================================================
 * A Db is a cheap handle pinned to a basis tx, not a materialized
 * value. Reads are async because backends are. Holding one across
 * ticks is safe: history is append-only, so a basis never changes.
 * (The one caveat is `excise`, which can remove datoms out from
 * under an old basis — the price of lawful erasure, documented
 * there.)
 *
 * TIME-TRAVEL ALGEBRA, pinned. `asOf`, `since` and `history` are
 * three orthogonal view parameters over one history:
 *  - `asOf(t)` sets the upper bound (inclusive); repeated calls
 *    keep the MINIMUM. Its `basis` is the greatest committed TxId
 *    ≤ t (a Date resolves through 'tx/at' first).
 *  - `since(t)` sets the lower bound (exclusive); repeated calls
 *    keep the MAXIMUM. It does not change `basis`.
 *  - together they form the window (since, asOf] — "what changed
 *    in Q3" is `db.asOf(q3end).since(q3start)`; an empty window is
 *    legal and reads as empty.
 *  - `history()` is an orthogonal flag: retractions become visible
 *    and the 5th pattern position becomes meaningful; it composes
 *    with any window. Calling it twice is idempotent.
 *  - `with(ops)` marks the Db HYPOTHETICAL (and its added datoms'
 *    tx ids carry the reserved origin — see TxId); the flag is
 *    inherited by every view derived from it.
 */

/** the four sort orders every backend maintains */
export type Index = 'eavt' | 'aevt' | 'avet' | 'vaet';

export interface Db {
  readonly basis: TxId;

  /**
   * Run a query. The result is a SET delivered as an array in
   * UNSPECIFIED order — never depend on it; the ordered read is
   * `page`. Rows and the inputs argument are typed per QUERY
   * TYPING: a literal query infers, a declared `Query<R, I>`
   * asserts, a wire-decoded query degrades to open shapes with an
   * optional untyped `inputs` — which is exactly what makes
   * footprint replay (`db.query(fp.query, fp.inputs)`) compile.
   */
  query<Q extends QuerySource>(
    q: Q & ValidateQuery<Q>,
    ...inputs: InputsArg<InputsFor<Q>>
  ): Promise<RowsFor<Q>[]>;

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
   * Footprints are materialized arrays by design: a sync unit is
   * meant to be a bounded, app-shaped slice. A footprint too large
   * to hold is a sign the query is the wrong sync unit — narrow it
   * with inputs — and bulk transfer of everything is `scan`/`log`,
   * not this.
   *
   * Rejects {code:'unsupported-on-hypothetical'} against a `with()`
   * Db: hypothetical datoms carry tx ids that exist in no history,
   * so they must never enter a footprint (see Db.with).
   */
  datoms<Q extends QuerySource>(
    q: Q & ValidateQuery<Q>,
    opts?: {
      named: { inputs: InputsFor<Q>; since?: TxId };
      none: { since?: TxId };
      open: { inputs?: InputMap; since?: TxId };
    }[InputsMode<InputsFor<Q>>]
  ): Promise<Footprint<RowsFor<Q>, InputsFor<Q>>>;

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
   * value and index that attr (see AttrSpec.from).
   *
   * Deliberately NOT a sync unit: an ordered, bounded range has no
   * stable footprint — the 51st datom moves it. Sync with `datoms`;
   * page with `scan`. Runs against `asOf`/`since`/`history` Dbs
   * like everything else, which also makes it the bulk-export and
   * backup read. On a `with()` Db, hypothetical datoms appear with
   * their reserved-origin tx ids — visibly not committable.
   *
   * `start` (inclusive) and `end` (exclusive) bound the first key
   * component after the prefix — the range seek behind SQL's
   * BETWEEN, LIKE 'q%' and keyset pagination:
   *
   *   scan('avet', ['user/handle'], { start: 'ab', end: 'ab\uffff' })
   *
   * `start`/`end` keep their key-space meaning under `reverse`:
   * start is always the lower bound and end the upper; reverse only
   * flips traversal direction within [start, end).
   *
   * 'avet' requires `index` or `unique` on the attr (else
   * {code:'not-indexed'}); 'vaet' exists only for ref attrs (else
   * {code:'not-a-ref'}). Errors surface on the first `next()` of
   * the iterable, as a QueryRejected.
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
   * `by` names a *scalar* column of R — a key, so the compiler
   * catches both a typo'd sort column and an attempt to sort by a
   * `collect` column at the call site (arrays have no place in the
   * pinned value order); when R is the open RowShape (wire), `by`
   * is any string and mistakes fall to {code:'unorderable-column'}
   * at runtime. The total order is `by`, then the remaining scalar
   * columns in lexicographic key order, so ties break
   * deterministically without each call saying how — and scalar
   * columns always suffice, because rows are grouped by their
   * scalar entries and so cannot collide on all of them. `collect`
   * columns never participate in ordering or in cursor equality;
   * they ride along. `reverse` flips the whole order.
   *
   * `after` is the previous page's last row, and the next page
   * resumes strictly beyond it — by the row's scalar column values,
   * which is keyset pagination, immune to the drift that makes
   * OFFSET lie under concurrent writes, and valid even when the
   * cursor row came from an older basis. Against a single Db basis,
   * successive pages tile the result exactly, no gaps and no
   * repeats.
   *
   * q stays an ordinary, unordered Query: sync it with `datoms`,
   * watch it with `watch`, page it here. The page itself is not a
   * sync unit, for the same reason a scan is not. When `by` comes
   * off an indexed attr the engine may answer with a range walk
   * rather than materializing q — but that is a planner's business,
   * not the contract's.
   */
  page<Q extends QuerySource>(
    q: Q & ValidateQuery<Q>,
    opts: {
      by: string extends keyof RowsFor<Q> ? string : ScalarKeys<RowsFor<Q>>;
      reverse?: boolean;
      limit: number;
      after?: RowsFor<Q>;
    } & {
      named: { inputs: InputsFor<Q> };
      none: { inputs?: undefined };
      open: { inputs?: InputMap };
    }[InputsMode<InputsFor<Q>>]
  ): Promise<RowsFor<Q>[]>;

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
   * T is the caller's declared tree type — trusted, not proven, and
   * declared-only on purpose: subtree shape is cardinality, which
   * is schema knowledge selectors don't have (see Pull). Preflight
   * a selector against a schema with `checkPull` when it matters.
   * A pull reads precisely the datoms of its tree, so it composes
   * with `asOf` and `since` like every read — but not with
   * `history()`, where a card-one attr has many values across time
   * and "the tree" is undefined; that rejects with
   * {code:'unsupported-on-history'}. History reads are queries
   * (with the 5th pattern position) and scans. Pull carries no
   * query power at all — filtering, sorting or aggregating a
   * subtree is a job for datalog, by design.
   *
   * T defaults to `unknown`, not to a loose record: an unannotated
   * pull returns something the caller must narrow deliberately,
   * rather than an object that silently permits any property access.
   * `pullMany<Record<string, Cell>>(…, ['*'])` is the idiom for a
   * genuinely dynamic read.
   */
  pull<T = unknown>(ref: Ref, selector: Pull): Promise<T | null>;
  /** one round trip for a page of trees; result order and length mirror `refs` */
  pullMany<T = unknown>(
    refs: readonly Ref[],
    selector: Pull
  ): Promise<readonly (T | null)[]>;

  /**
   * The current schema, read back as the shape you transact — sugar
   * over querying the reserved 'attr/*' datoms (see SCHEMA), so it
   * time-travels: yesterday's Db returns yesterday's schema. Returns
   * USER attrs only; the engine's reserved attrs are contract, not
   * data to redeclare. This is the live value `schemaDrift` and the
   * check* validators take.
   */
  schema(): Promise<Schema>;

  // ── time travel (composition algebra pinned in the section header) ──
  /** upper bound (inclusive); repeated calls keep the minimum; Date resolves via 'tx/at' */
  asOf(t: TxId | Date): Db;
  /** lower bound (exclusive) — "what's new"; repeated calls keep the maximum */
  since(t: TxId | Date): Db;
  /** every datom ever, retractions included; `op` is meaningful here; idempotent */
  history(): Db;

  /**
   * Hypothetical: apply ops in memory, get a Db, persist nothing.
   * The added datoms carry tx ids under the reserved hypothetical
   * origin (see TxId): they exist in no history, `ingest` rejects
   * them ('malformed'), and `datoms` rejects on this Db
   * ('unsupported-on-hypothetical') — a what-if can be queried,
   * paged, pulled and scanned, but never synced, because a footprint
   * of facts nobody committed would fork every peer that ingested
   * it. The hypothetical flag is inherited by derived views.
   */
  with(ops: readonly Op[]): Promise<Db>;
}

export interface Footprint<
  R extends RowShape = RowShape,
  I extends InputShape = InputShape,
> {
  datoms: Datom[];
  /** basis of the snapshot these came from */
  basis: TxId;
  /**
   * Echoed back so the consumer can re-run identically. Its static
   * type is the OPEN query (both generics defaulted), which is why
   * `db.query(fp.query, fp.inputs)` compiles on any peer with no
   * declarations — see InputsMode 'open'.
   */
  query: Query<R, I>;
  inputs: I;
}

/**
 * ============================================================
 *  CONNECTION — the only mutable thing
 * ============================================================
 * Lifecycle, pinned:
 *  - WRITES SERIALIZE. `transact`, `ingest` and `excise` apply one
 *    at a time per Connection; each is atomic (all of it or a
 *    rejection); ordering among concurrent callers is unspecified —
 *    `onBasis` is the tool when order matters to correctness.
 *  - `close()` is idempotent. In-flight operations settle; open
 *    `scan`/`log` iterators end normally (no throw); watchers stop;
 *    every subsequent call rejects with {code:'closed'} (TxError or
 *    QueryError by path). Db handles from a closed Connection
 *    reject the same way.
 */

export interface Connection {
  /**
   * This store's origin id — the 8 hex chars after the '-' in every
   * TxId it mints (see TxId). Minted once at store creation and
   * stable for the store's life.
   *
   * It is exposed because sync policy lives in the caller and needs
   * it: "which of these datoms are mine to push" is
   * `d.tx.endsWith('-' + conn.origin)`, and without an accessor the
   * only way to learn it is to commit a transaction and parse its
   * id. Reading it says nothing about topology — who peers with
   * whom, and who wins beyond greater-tx-id, remains the caller's
   * business.
   */
  readonly origin: string;

  /** current snapshot */
  db(): Db;

  /** rejects with TxRejected; `reason` says why, as data */
  transact(ops: readonly Op[], opts?: TxOptions): Promise<TxReport>;

  /**
   * Apply foreign datoms verbatim, preserving their original tx
   * ids. Idempotent over `key(d)` — re-ingesting anything already
   * present is a no-op, so retrying a delivery is always safe.
   * Atomic like transact: all datoms apply or none do. This is how
   * a peer absorbs a Footprint — it must not mint a local tx, or
   * histories would diverge. Ingesting also advances the local
   * clock past every ingested TxId, so transactions committed
   * afterward order after the history they observed (see TxId).
   * Datoms bearing the reserved hypothetical origin reject with
   * 'malformed' — a `with()` fact can never enter a real history.
   *
   * Constraints are a transact-time concern and are NOT re-checked
   * here: a fact a peer committed is a fact, even when it collides
   * with one committed locally. Where two live assertions compete —
   * card 'one', or `unique` — the current value is the one with the
   * greater tx id; TxIds are globally unique, so this comparison
   * always decides, identically on every peer, and ingestion order
   * never matters. Anything smarter than that is policy, and policy
   * lives in the caller: read both, decide, transact.
   *
   * One class of datom is executed rather than merely stored:
   * excision records (reserved 'excise/*' attrs — see `excise`).
   * Ingesting an excision removes every covered datom already held
   * and is remembered as a tombstone that filters covered datoms
   * arriving later, so peers converge on the removal regardless of
   * delivery order. This is the same immutability hole `excise` is,
   * propagated — nothing else in ingest has side effects beyond
   * appending.
   */
  ingest(datoms: readonly Datom[]): Promise<{ applied: number; basis: TxId }>;

  /**
   * The one sanctioned hole in immutability: remove datoms from
   * history as if never asserted, for the erasures the law demands.
   * An entity target removes every datom about it; an [entity, attr]
   * target removes one attribute's history. Tx entities are legal
   * targets — erasing provenance is a lawful need — and excising one
   * removes the datoms ON the tx entity ('tx/author' and friends),
   * never the transaction's own data datoms (a datom's `tx` field is
   * not a datom). The excision itself is recorded — as datoms on an
   * excision entity, under the reserved attrs 'excise/e' (ref) and
   * 'excise/attr' (string, absent for whole-entity targets) — so it
   * syncs like any fact and peers converge on the removal (see
   * `ingest` for how): what disappears is the data, never the fact
   * that something was removed. After it, `asOf` and `history` no
   * longer see the excised datoms — including through Db handles
   * taken before the excision, which is exactly the immutability
   * breach this is documented as. Not a modeling tool; retraction
   * is.
   *
   * A target holding no datoms is not an error: the excision record
   * is still written and still syncs, so a peer that later receives
   * the covered datoms filters them by the tombstone. Erasure has to
   * be expressible before the data arrives — that is the whole point
   * of recording it — so "nothing to remove here yet" is a normal
   * outcome, and `TxReport.datoms` (the record itself) is what comes
   * back. An unresolvable LookupRef target is still 'malformed'.
   */
  excise(targets: readonly (Ref | readonly [Ref, Attr])[]): Promise<TxReport>;

  /**
   * Raw tx log, for replication and audit; bounds are (from, to] —
   * from exclusive, like `since`. BOUNDED: with `to` omitted, the
   * iteration completes at the head as of the call — it does not
   * tail. Live continuation is `on('tx')`; the replication idiom is
   * catch up with `log`, then subscribe, deduping the overlap by
   * TxId (both sides are idempotent to replay, so the seam is
   * safe).
   */
  log(from?: TxId, to?: TxId): AsyncIterable<TxReport>;

  /**
   * Fires once per committed, ingested or EXCISED tx, after commit —
   * an excision is a transaction like any other and its report
   * carries the excision record's datoms (never the removed ones,
   * which by then do not exist). Listener
   * exceptions are caught and discarded — they can never affect a
   * commit. Delivery order across listeners is unspecified; the
   * returned unsubscribe is idempotent.
   */
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
 * but the observable contracts above: append-only history (excision
 * aside), stable bases, the pinned value order, globally unique
 * TxIds under the pinned format, and identical answers from
 * identical datoms.
 */
export interface Backend {
  readonly __backend: unique symbol;
}

export interface OpenOptions {
  backend: Backend;
  /**
   * Asserted on open if absent; no-op if unchanged; widenings only —
   * see SCHEMA. A schema *narrower* than what the store already
   * holds (the rolled-back-deploy case) rejects open with
   * TxRejected {code:'schema-incompatible'} rather than silently
   * running old code against wider data.
   */
  schema?: Schema;
}

export function open(opts: OpenOptions): Promise<Connection>;

/**
 * ============================================================
 *  SUGAR  (built on the above, zero new capability)
 * ============================================================
 */

/**
 * Map form → ops. `id` is required: the caller mints it (`newId`)
 * and therefore always holds it — an earlier draft allowed omitting
 * it, which produced entities whose ids existed only inside the
 * returned ops, fishable but never handed to you.
 */
export function entity(
  m: { id: Ref } & Record<Attr, Value | readonly Value[]>
): Op[];

/**
 * Escape a runtime string for use inside an 're' pattern, so user
 * input matches itself rather than acting as syntax. LIKE 'q%' is
 * ['re', '?v', p] with p bound to '^' + escapeRe(q).
 */
export function escapeRe(s: string): string;

/**
 * Live query. Semantics, pinned:
 *  - fires once IMMEDIATELY with the current rows, then on change;
 *  - deliveries may COALESCE under rapid writes — intermediate
 *    states can be skipped, but bases are monotonic and the latest
 *    state is always eventually delivered;
 *  - a re-run can fail (an attr excised, the connection closing):
 *    `onError` receives the QueryRejected and the watch stops; with
 *    no handler it stops silently. Stopping is also what `close()`
 *    does to every watcher.
 * `inputs` follows the same three modes as `Db.query`: required
 * when the query names parameters, forbidden when it provably has
 * none, optional and untyped for wire-decoded queries.
 */
export function watch<Q extends QuerySource>(
  conn: Connection,
  q: Q & ValidateQuery<Q>,
  fn: (rows: RowsFor<Q>[], db: Db) => void,
  ...opts: {
    named: [
      opts: { inputs: InputsFor<Q>; onError?: (e: QueryRejected) => void },
    ];
    none: [opts?: { onError?: (e: QueryRejected) => void }];
    open: [opts?: { inputs?: InputMap; onError?: (e: QueryRejected) => void }];
  }[InputsMode<InputsFor<Q>>]
): () => void;

/**
 * RUNTIME VALIDATORS — the schema-aware half of the typing story
 * (goal 4), as pure functions. Each renders the same judgment the
 * engine would render first, as the same error data, without
 * executing anything: shape/grammar violations ('malformed'),
 * unknown attrs, non-fulltext fts targets, unknown rules, unbound
 * vars, unstratifiable recursion, and for ops every transact-time
 * check that needs no store state (type mismatches, derived-attr
 * writes, reserved-attr writes — not unique conflicts or cas, which
 * are facts-dependent). Null means "the engine would accept this
 * shape against this schema."
 *
 * These are THE preflight for wire traffic — a sync endpoint
 * validates a decoded query with `checkQuery` and 400s with the
 * error payload instead of running it — and the startup check for
 * apps: run each registered query through `checkQuery(await
 * db.schema(), q)` once at boot and a typo'd attr surfaces
 * immediately rather than on first use. Compile-time types cannot
 * do this by design (queries are schema-independent); these
 * functions are where that responsibility landed.
 *
 * Each returns the FIRST problem in document order — clause order
 * for a query, entry order for a selector, op order for ops — the
 * same determinism rule `TxRejected.reason` follows, so a validator
 * and the engine name the same problem for the same input. Fix and
 * re-check; there is no error list to merge.
 */
export function checkQuery(schema: Schema, src: unknown): QueryError | null;
export function checkPull(schema: Schema, selector: unknown): QueryError | null;
export function checkOps(schema: Schema, ops: unknown): TxError | null;

/**
 * One reported difference between a schema constant a build shipped
 * with and a store's live schema. Pure data, like every error here.
 */
export interface SchemaDrift {
  attr: Attr;
  field: keyof AttrSpec;
  declared: unknown;
  live: unknown;
  /** true where the drift invalidates declared row/tree types: `type`, and card 'one' vs 'many' */
  breaksTypes: boolean;
}

/**
 * Compare a static schema constant against a live one (from
 * `Db.schema()`), returning every difference as data — the deploy
 * guard. Declared `Query<R, I>` rows and `pull<T>` trees are static
 * claims; a live card 'one' → 'many' migration changes result
 * shapes (scalar → array) out from under them. Dev builds should
 * call this at open and treat `breaksTypes: true` entries as
 * failures.
 */
export function schemaDrift(declared: Schema, live: Schema): SchemaDrift[];

/**
 * ============================================================
 *  EXAMPLE — a note-taking app, end to end
 * ============================================================
 * Users own folders, folders nest, notes live in folders. Nothing
 * below defines anything new; it only exercises what is above, and
 * it touches every entry point once. Every query is a PLAIN OBJECT:
 * no constructor, no schema import — `as const` keeps the text
 * literal for structural inference, and one query is annotated
 * `Query<R, I>` to show the declared door on the same plain object.
 */

/** the schema: a runtime value — transacted, opened with, preflighted against. Queries never touch it. */
const NOTES: Schema = {
  'user/handle': { type: 'string', unique: true },
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
};

interface ExampleIds {
  ada: EntityId;
  inbox: EntityId;
  work: EntityId;
  note: EntityId;
}

const EXAMPLE_INSTANT = new Date('2024-01-15T12:00:00.000Z');
const EXAMPLE_YESTERDAY = new Date('2024-01-14T12:00:00.000Z');

// THE DECLARED DOOR: a plain object with a type annotation — precise
// value types by the author's claim, zero coupling to NOTES.
const EXAMPLE_IN_FOLDERS: Query<
  { title: string; fname: string },
  { handle: string }
> = {
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

// THE INFERRED DOOR: the same kind of plain object, kept literal with
// `as const`. The text proves: title → Value (value types are schema
// knowledge), root → EntityId-ish via the rule bodies (degrading to
// Value past the recursion depth budget — still legal to pass an id).
const EXAMPLE_UNDER = {
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
} as const satisfies QuerySource;

const EXAMPLE_EMPTY = {
  find: { fname: '?fname' },
  where: [
    ['?f', 'folder/name', '?fname'],
    ['not', ['?n', 'note/folder', '?f']],
  ],
} as const satisfies QuerySource;

// Inferred structurally: { fname: Value; notes: number; tags: readonly Value[] }
// — count is number, collect is an array; fname is Value without a schema.
const EXAMPLE_PER_FOLDER = {
  find: {
    fname: '?fname',
    notes: ['count', '?n'],
    tags: ['collect', '?tag'],
  },
  where: [
    ['?f', 'folder/name', '?fname'],
    ['?n', 'note/folder', '?f'],
    ['?n', 'note/tag', '?tag'],
  ],
} as const satisfies QuerySource;

// Collection input: ?n sits in entity positions, so the text itself
// proves inputs { n: readonly EntityId[] } — no schema needed.
const EXAMPLE_BY_IDS = {
  find: { n: '?n', title: '?title' },
  in: { n: ['?n'] },
  where: [['?n', 'note/title', '?title']],
} as const satisfies QuerySource;

const EXAMPLE_SEARCH = {
  find: { n: '?n', hit: '?hit' }, // ?hit: string — fts proves it from text alone
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
} as const satisfies QuerySource;

const EXAMPLE_LAST_EDITOR = {
  find: { title: '?title', who: '?who' },
  where: [
    ['?n', 'note/title', '?title', '?tx'],
    ['?tx', 'tx/author', '?u'],
    ['?u', 'user/handle', '?who'],
  ],
} as const satisfies QuerySource;

/** a literal that would otherwise parse as a var, bound safely via inputs */
const EXAMPLE_LITERAL = {
  find: { n: '?n' },
  in: { exact: '?exact' },
  where: [['?n', 'note/title', '?exact']],
} as const satisfies QuerySource;

// The three lexical compile checks (they fire at the call site, since a
// plain object has no definition-site hook):
//   db.query({ find: { t: '?titel' },
//              where: [['?n','note/title','?title']] } as const)
//     → ERROR — find var is not bound by where, rules, or in: '?titel'
//   db.query({ find: { t: '?title' }, in: { dead: '?x' },
//              where: [['?n','note/title','?title']] } as const, { dead: 1 })
//     → ERROR — in var is never used in where or find: '?x'
//   db.query({ find: { n: '?n', total: ['count','?n'] },
//              where: [['?n','note/title','?t']] } as const)
//     → ERROR — aggregating a var that is also projected bare is constant
//       per row (count is always 1); add a `with` clause or aggregate a
//       different var: '?n'
// Schema mistakes ('note/titl', fts on a non-fulltext attr) are NOT
// compile errors by design — they are runtime judgments; see checkQuery
// in exampleSeed and the QueryError family.

/** a pull selector: plain data; its tree type is declared at the call */
const NOTE_CARD = [
  'note/title',
  'note/tag',
  { 'note/folder': ['folder/name'] },
] as const satisfies Pull;

interface NoteCardTree {
  'note/title'?: string;
  'note/tag'?: readonly string[];
  'note/folder'?: { 'folder/name'?: string };
}

interface FolderTree {
  'folder/name'?: string;
  'note/_folder'?: readonly { 'note/title'?: string }[];
  'folder/parent'?: FolderTree;
}

async function exampleSeed(conn: Connection): Promise<ExampleIds> {
  await conn.transact([['schema', NOTES]]);

  // Startup preflight: every registered query and selector against the
  // live schema. A typo'd attr surfaces HERE, as data, not on first use.
  const live = await conn.db().schema();
  for (const query of [
    EXAMPLE_IN_FOLDERS,
    EXAMPLE_UNDER,
    EXAMPLE_EMPTY,
    EXAMPLE_PER_FOLDER,
    EXAMPLE_BY_IDS,
    EXAMPLE_SEARCH,
    EXAMPLE_LAST_EDITOR,
    EXAMPLE_LITERAL,
  ]) {
    const err = checkQuery(live, query);
    if (err) throw new Error(`bad query: ${JSON.stringify(err)}`);
  }
  if (checkPull(live, NOTE_CARD)) throw new Error('bad selector');
  // e.g. checkQuery(live, { find: { t: '?t' },
  //                         where: [['?n', 'note/titl', '?t']] })
  //      → { code: 'unknown-attr', attr: 'note/titl' }

  // Deploy guard: the schema constant this build shipped with vs the
  // live store — a card 'one'→'many' migration breaks declared types.
  if (schemaDrift(NOTES, live).some((d) => d.breaksTypes)) {
    throw new Error('schema drift breaks declared types');
  }

  const ada = newId(),
    inbox = newId(),
    work = newId(),
    note = newId();

  await conn.transact([
    ...entity({
      id: ada,
      'user/handle': 'ada',
      'user/name': 'Ada Lovelace',
    }),
    ...entity({
      id: inbox,
      'folder/name': 'inbox',
      'folder/owner': ada,
    }),
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

  // unique is a throw, never an upsert: a second 'ada' names its holder
  await conn
    .transact([['+', newId(), 'user/handle', 'ada']])
    .catch((e: TxRejected) =>
      e.reason.code === 'unique-conflict'
        ? void e.reason.holder
        : Promise.reject(e)
    );

  return { ada, inbox, work, note };
}

async function exampleQueries(db: Db, ids: ExampleIds): Promise<void> {
  const { inbox, note } = ids;

  // declared door: title is string by the author's claim
  const rows = await db.query(EXAMPLE_IN_FOLDERS, { handle: 'ada' });
  rows[0]?.title.toUpperCase();

  // inferred door: what the text proves, no schema anywhere
  await db.query(EXAMPLE_UNDER, { root: inbox });
  const per = await db.query(EXAMPLE_PER_FOLDER);
  per[0]?.notes.toFixed(); // notes: number — proved by ['count', …]
  await db.query(EXAMPLE_EMPTY);
  await db.query(EXAMPLE_BY_IDS, { n: [note /* …forty-nine more */] });
  const hits = await db.query(EXAMPLE_SEARCH, { needle: 'algebra mill*' });
  hits[0]?.hit.toLowerCase(); // hit: string — proved by the fts clause
  await db.query(EXAMPLE_LITERAL, { exact: '?help' }); // matches a title "?help"
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
  for await (const d of db.scan('avet', ['user/handle'], {
    start: 'a',
    end: 'a\uffff', // start/end keep key-space meaning even under reverse
  }))
    void d;

  // by: 'notes' — a scalar column; 'tags' (collect) is rejected by
  // ScalarKeys at compile time. Ties on notes break by fname.
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

  // pull: T is declared — cardinality is schema knowledge, so tree
  // types are the caller's claim (preflighted by checkPull at boot).
  const card = await db.pull<NoteCardTree>(note, NOTE_CARD);
  card?.['note/folder']?.['folder/name']?.toUpperCase();

  const tree = await db.pull<FolderTree>(work, [
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

  // both cas directions: assert-if-absent, retract-if-still
  await conn
    .transact([['cas', note, 'note/body', null, 'draft body']])
    .catch((e: TxRejected) =>
      e.reason.code === 'cas-failed' ? undefined : Promise.reject(e)
    );
  await conn
    .transact([['cas', note, 'note/body', 'draft body', null]])
    .catch((e: TxRejected) =>
      e.reason.code === 'cas-failed' ? undefined : Promise.reject(e)
    );

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

  // the time-travel algebra: a window is asOf + since composed
  const q3 = conn.db().asOf(EXAMPLE_INSTANT).since(EXAMPLE_YESTERDAY);
  await q3.query(EXAMPLE_PER_FOLDER);

  for await (const d of conn.db().history().scan('eavt', [note])) {
    if (d.a === 'note/title') {
      void [d.v, d.tx, d.op];
      // both directions of the tx bridge:
      const te = txEntity(d.tx); // correlate a raw datom with its tx datoms
      const back = txIdOf(te); // and a queried tx entity back into asOf/since/log
      void [te, back];
    }
  }

  // pull is undefined over history — one card-one attr, many values:
  await conn
    .db()
    .history()
    .pull(note, NOTE_CARD)
    .catch((e: QueryRejected) =>
      e.reason.code === 'unsupported-on-history' ? null : Promise.reject(e)
    );
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

  // the replication idiom: catch up bounded, then tail live, dedupe by
  // tx — and push only what this store minted, which is what origin is for
  const mine = (t: TxId) => t.endsWith(`-${conn.origin}`);
  const seen = new Set<TxId>();
  for await (const report of conn.log(fp.basis)) {
    seen.add(report.tx);
    if (mine(report.tx)) void report.datoms; // ship upstream
  }
  const untail = conn.on('tx', (r) => {
    if (!seen.has(r.tx) && mine(r.tx)) void r.datoms;
  });

  // a footprint crosses a wire under the pinned encoding, losslessly —
  // and REPLAYS on the other side with no declarations: fp.query is the
  // open Query, so inputs are optional and untyped ('open' mode).
  const wire = JSON.stringify(wireEncode(fp));
  const back = wireDecode(JSON.parse(wire)) as Footprint;
  await conn.db().query(back.query, back.inputs);
  // …and on the other peer: await otherConn.ingest(back.datoms) —
  // verbatim, idempotent by key(d), preserving TxIds so histories
  // converge. (checkQuery(schema, back.query) is the preflight there.)

  const stop = watch(conn, EXAMPLE_UNDER, (rows, at) => void [rows, at.basis], {
    inputs: { root: inbox },
    onError: (e) => void e.reason, // the watch has stopped; e says why
  });

  // hypothetical: query it freely — but it is not a sync unit, and its
  // datoms carry the reserved origin no ingest will accept.
  const maybe = await conn.db().with([['-', note]]);
  await maybe.query(EXAMPLE_PER_FOLDER);
  await maybe
    .datoms(EXAMPLE_PER_FOLDER)
    .catch((e: QueryRejected) =>
      e.reason.code === 'unsupported-on-hypothetical'
        ? undefined
        : Promise.reject(e)
    );

  await conn.excise([ada, [note, 'note/body']]);

  untail();
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
