# Polyglot Database Schema Framework Refactor

## Mission

Perform a comprehensive refactor of the product's existing `db-schema` framework to establish a high-quality, language-neutral, code-generated schema system.

This is the first step toward making the product a genuinely polyglot application platform supporting independently implemented TypeScript, Swift, Rust, Kotlin, and future clients and servers.

Currently, database schemas are authored using TypeScript's `defineTable` API. The framework supports PostgreSQL on the server and SQLite on clients, but the source definitions are tied to TypeScript.

Replace that authoring model with **declarative, language-neutral schema specifications**, preferably YAML, and generate strongly typed native objects and metadata for supported languages.

The architecture must preserve existing database behavior, migrations, offline-first synchronization, and application integration.

This is an implementation task. Inspect the repository, select the smallest coherent design, implement it, migrate all affected definitions, validate compatibility, and remove obsolete authoring paths.

Do not stop at a proposal or proof of concept.

---

## 1. Core Architectural Principles

The new framework must satisfy these requirements.

### One authoritative source

Database schemas are defined once in language-neutral files.

TypeScript, Swift, PostgreSQL, and SQLite implementations are derived from those definitions.

No language-specific implementation may independently redefine a table's columns, indexes, types, or constraints.

### Specification-first

The canonical schema definition is declarative data, not executable TypeScript.

A schema package must be understandable and consumable without executing JavaScript or importing a TypeScript framework.

### Native generated APIs

Generate idiomatic, strongly typed APIs for each target language.

TypeScript receives native TypeScript types and table descriptors.

Swift receives native Swift types and table descriptors.

Do not force Swift to interpret TypeScript objects or execute a YAML interpreter during normal application runtime.

### Opinionated design

Provide one supported method of defining database schemas.

Make correct definitions easy and incorrect definitions fail early.

Do not maintain multiple competing schema authoring mechanisms.

### Extensibility

The design must accommodate future Rust, Kotlin, Go, and other language generators without changing the schema source format for every new language.

### Minimal complexity

Use existing standards, parsers, schema validators, and code-generation conventions where appropriate.

Do not build a general-purpose IDL compiler, ORM, query language, or configuration framework unnecessarily.

### Preserve behavior

The migration must preserve all existing schema semantics.

Do not introduce accidental changes to column types, constraints, indexes, defaults, nullability, serialization, migrations, or stored records.

---

## 2. Target Architecture

Use this conceptual pipeline:

```text
Language-neutral YAML schema definitions
                  |
                  v
       Specification validation
                  |
                  v
       Canonical schema model
                  |
        +---------+---------+---------+
        |         |         |         |
        v         v         v         v
    TypeScript   Swift   PostgreSQL  SQLite
     objects     objects   schema     schema
        |         |         |         |
        v         v         v         v
     Web/Bun   iOS/macOS   Server    Local DB
```

The canonical schema model is the only input to language-specific generation and database schema emission.

The model must be deterministic, validated, versioned appropriately, and independent of any particular runtime.

The TypeScript generator must not have privileged schema semantics that the Swift generator needs to reproduce independently.

PostgreSQL and SQLite emitters must use the same logical schema, with deliberate and tested dialect-specific mappings.

---

## 3. Package Naming Convention

Adopt and enforce the following convention for affected packages.

**Language-specific packages always end with a language suffix.**

- TypeScript: `-ts`
- Swift: `-swift`
- Future Rust: `-rust`
- Future Kotlin: `-kotlin`

**Language-neutral specification/data packages omit the language suffix.**

Do not use the absence of a suffix to mean TypeScript by default.

If a tooling package is implemented in TypeScript, it is a TypeScript package and ends with `-ts`, even when it generates code for other languages.

Preserve existing runtime categories such as `client`, `server`, and `shared`, placing the language suffix last.

For example:

```text
db-schema-root-shared-ts
db-schema-root-shared-swift
db-schema-postgres-ts
db-schema-sqlite-ts
```

A purely language-neutral schema package should have no `-ts` or `-swift` suffix.

Retain lowercase kebab-case naming. Do not adopt dot-separated package names.

Use each package's manifest as the authoritative source for its language, runtime, ownership, and build metadata rather than attempting to infer everything from its directory name.

Update the repository's naming and package-boundary checks to enforce these conventions for the affected architecture.

Do not perform an unrelated repository-wide package rename.

---

## 4. Preferred Package Structure

Design the smallest package set that provides clear ownership and extensibility.

The following structure is a reference design. Inspect the actual repository before finalizing paths.

```text
pkgs/
  db-schema/
    schema.schema.json

  db-schema-codegen-ts/
    src/
      generate.ts
      validate.ts
      canonicalize.ts
      emit-typescript.ts
      emit-swift.ts

  db-schema-root-shared-ts/
    src/
      table.ts
      column.ts

  db-schema-root-shared-swift/
    Package.swift
    src/
      table.swift
      column.swift

  db-schema-postgres-ts/
    src/
      emit-schema.ts

  db-schema-sqlite-ts/
    src/
      emit-schema.ts

libs/
  billing-schema/
    billing.schema.yaml

  billing-schema-shared-ts/
    src/
      billing-subscriptions.ts
      billing-account-closures.ts
      billing-payment-evidence.ts
      billing-tables.ts

  billing-schema-shared-swift/
    Package.swift
    src/
      billing-subscriptions.swift
      billing-account-closures.swift
      billing-payment-evidence.swift
      billing-tables.swift
```

### Flatness is mandatory

Packages must remain extremely flat.

- No deep feature-folder hierarchies.
- No folders for every table.
- No unnecessary barrel exports.
- No per-table packages.
- No duplicated schema definitions.
- No packages created solely to satisfy a theoretical future language.
- No unnecessary wrapper-only packages.

Use a package's flat `src/` modules for implementation and generated files.

For Swift Package Manager, configure the target's source path explicitly if needed to preserve the flat structure.

Language-neutral schema packages may contain a small collection of YAML files directly in their package root.

Prefer one schema specification per bounded context or cohesive ownership unit, not one new package per database table.

Create only the packages actually needed. Reuse suitable existing packages rather than automatically creating every package illustrated above.

### Ownership

Generic schema grammar, validation, canonicalization, and generation infrastructure belong in product-independent `pkgs/`.

Billing's actual schema belongs to the Billing bounded context under `libs/`.

The framework must never depend on Billing or any other concrete product domain.

Product-owned language packages may depend on generic schema-runtime packages, never the reverse.

---

## 5. Language-Neutral Schema Format

Design a concise, strongly validated YAML schema format that expresses the capabilities of the existing `defineTable` API.

For example, the current Billing definitions should become conceptually equivalent to:

```yaml
schemaVersion: 1
domain: billing

tables:
  - name: billing_subscriptions
    description: >
      Provider-neutral subscription projection.
      Written by vendor webhooks and synchronized
      for offline access evaluation.

    columns:
      account_id: text
      provider: text
      provider_subscription_id: text
      price_key: text
      status: text
      current_period_end: timestamp
      cancel_at_period_end: boolean
      credit_cents:
        type: integer
        description: >
          Provider credit in cents.
          Never negative; blank until populated.

    indexes:
      - account_id

    uniqueIndexes:
      - [provider, provider_subscription_id]

  - name: billing_account_closures

    columns:
      account_id: text
      provider: text
      subscription_id: text
      customer_id: text
      confirmed_at: timestamp
      cancellation_status: text

    indexes:
      - account_id

    uniqueIndexes:
      - [provider, subscription_id]

  - name: billing_payment_evidence

    columns:
      account_id: text
      provider: text
      payment_id: text
      paid_at: timestamp
      amount_minor: integer
      currency: text
      refunded_minor: integer
      erase_by: timestamp
      legal_purpose: text
      legal_end_condition: text

    indexes:
      - erase_by

    uniqueIndexes:
      - [provider, payment_id]
```

This format is illustrative. Finalize it against the existing `defineTable` semantics and emitters.

Do not silently infer `NOT NULL`, a primary key, a zero default, or an enforced nonnegative constraint from the example.

Comments and descriptions are documentation, not automatically database constraints.

Preserve the actual current semantics, including any implicit framework-generated columns or constraints.

### Schema language requirements

Support the existing table vocabulary, including:

- Domain ownership.
- Table identity.
- Column definitions.
- Logical column types.
- Indexes.
- Composite unique indexes.
- Existing default/nullable/constraint semantics.
- Existing metadata required by migrations and synchronization.

Allow concise scalar column declarations for ordinary columns.

Use a structured declaration only when additional properties are necessary.

For example:

```yaml
credit_cents:
  type: integer
  description: Provider credit in cents
```

Future capabilities may include explicit defaults, check constraints, foreign keys, or other supported database features, but do not implement speculative schema features unless required by the existing framework or a concrete use case.

The schema language should be deliberately smaller than either PostgreSQL or SQLite.

Do not introduce arbitrary executable expressions, embedded TypeScript, arbitrary SQL snippets, or language-specific callbacks as ordinary schema-definition values.

---

## 6. Validated Canonical Schema Model

Implement one parser and validator that converts language-neutral schema files into a canonical schema representation.

Use a standard JSON Schema or equivalent formal grammar to validate the authoring format.

YAML may be the human-friendly syntax, but the canonical representation should have deterministic, language-independent data semantics.

Validation must detect:

- Invalid schema versions.
- Unsupported logical types.
- Duplicate table identifiers.
- Duplicate column names.
- Invalid SQL identifiers.
- Indexes referencing nonexistent columns.
- Duplicate or conflicting indexes.
- Invalid compound constraints.
- Unsupported or ambiguous metadata.
- Incompatible schema options.
- Naming collisions in generated languages.
- Invalid or ambiguous generated symbol names.

Fail generation with precise diagnostics identifying the source file, table, field, and reason.

Never silently discard unsupported options or emit incomplete representations.

### Determinism

Identical source files must produce byte-for-byte identical generated outputs.

Use canonical ordering and explicit stable naming rules.

Do not depend on filesystem enumeration order, object identity, locale-specific sorting, current time, random identifiers, or environment-specific absolute paths.

Include reproducible generation metadata or content fingerprints where useful, without injecting nondeterministic timestamps.

---

## 7. Generate Strongly Typed TypeScript Objects

Generate the same conceptual functionality currently provided by handwritten `defineTable` objects.

For example, the generated TypeScript interface should remain compatible with existing consumers:

```typescript
export const billingSubscriptions = defineTable({
  domain: 'billing',
  name: 'billing_subscriptions',
  columns: {
    account_id: 'text',
    provider: 'text',
    provider_subscription_id: 'text',
    price_key: 'text',
    status: 'text',
    current_period_end: 'timestamp',
    cancel_at_period_end: 'boolean',
    credit_cents: 'integer',
  },
  indexes: ['account_id'],
  uniqueIndexes: [
    ['provider', 'provider_subscription_id'],
  ],
});
```

This is an example of generated output, not handwritten application source.

Also generate the existing table collections:

```typescript
export const BILLING_TABLES = [
  billingSubscriptions,
  billingAccountClosures,
  billingPaymentEvidence,
] as const;
```

Where appropriate, generate additional strongly typed interfaces for:

- Row data.
- Column identities.
- Logical column values.
- Nullable fields.
- Insert/update shapes where the existing system distinguishes them.
- Table descriptors.

Preserve existing public symbols and runtime behavior where required.

Do not invent new row-nullability semantics during code generation.

Generated types must accurately reflect the database contract, including integer-width and timestamp representation decisions.

### Source of truth

Generated TypeScript files must not be edited manually.

Application authors edit YAML and regenerate.

The existing `defineTable` implementation may remain as an internal TypeScript runtime primitive if it is useful for constructing generated descriptors.

However, manually authored product `defineTable` declarations must no longer be an alternative canonical schema source.

---

## 8. Generate Native Swift Objects

Create a first-class Swift generator.

It must produce native, idiomatic Swift APIs from the same canonical schema representation.

The generated Swift API should provide:

- Strongly typed table identity.
- Strongly typed columns and column metadata.
- Native row models where appropriate.
- Codable serialization/deserialization.
- Explicit field-name mappings.
- Correct nullability.
- Logical type information.
- Schema metadata needed by the native database adapter.

Illustrative target:

```swift
struct BillingSubscriptionRow:
    Codable, Sendable, Equatable
{
    // Generated native Swift properties.
    // Exact property types and optionality must
    // follow the validated schema semantics.
}

enum BillingSubscriptions {
    static let tableName = "billing_subscriptions"

    static let accountIdColumn = "account_id"
    static let providerColumn = "provider"
}
```

The generator should produce the concrete fields and complete metadata.

Use predictable, idiomatic Swift naming while preserving the original database identifiers for serialization and SQL access.

Do not require manually maintained `CodingKeys` files.

Avoid dynamic dictionaries and runtime reflection as the primary access mechanism when static generated types can provide safety.

Do not introduce an ORM merely to support schema generation.

### Swift Package Manager

Generated Swift output must compile as a normal Swift package.

Use the existing monorepo task orchestration.

Ensure that pure Swift schema generation and compilation can be checked independently of an iOS simulator when platform dependencies allow it.

---

## 9. Preserve PostgreSQL and SQLite Support

This is a non-negotiable requirement.

The schema framework currently supports:

- PostgreSQL on the authoritative server.
- SQLite on local clients.
- Offline-first state.
- Database migrations.
- Table registration and composition.

The refactor must not change this architecture.

Do not replace PostgreSQL with SQLite or introduce additional database services.

Existing PostgreSQL and SQLite emitters should consume the canonical schema representation, either directly or through a generated compatible descriptor.

They must not depend on executing handwritten product-specific TypeScript schema declarations.

### Logical type mapping

Define and verify mappings for every existing logical column type.

In particular, review:

- `text`
- `integer`
- `timestamp`
- `boolean`
- NULL and optional values
- Defaults
- Uniqueness
- Indexes
- Any framework-generated identity or lifecycle fields

Do not assume PostgreSQL and SQLite have identical storage representations.

Specify their differences explicitly and ensure generated TypeScript and Swift types have consistent logical meaning.

Preserve date/time round-trip behavior, numeric precision, and existing serialization semantics.

If different database backends use different physical types, both must still implement the same intended logical contract.

### Schema compatibility

Compare schema output before and after migration.

The initial conversion should result in **no unintended DDL changes**.

Test the actual generated schema, not merely the equality of two TypeScript metadata objects.

Do not silently rename indexes, reorder migrations, modify constraints, or change nullability.

---

## 10. Preserve Migration and Offline Compatibility

The database schema framework is foundational to the product's synchronization architecture.

A mistake here can affect every user and persisted record.

Respect the existing schema snapshot, migration, and reconciliation systems.

### Required guarantees

- Existing PostgreSQL databases remain valid.
- Existing local SQLite databases remain valid.
- Existing migration history remains interpretable.
- Schema generation is stable across machines.
- Schema changes produce predictable migration plans.
- An unchanged schema produces no migration changes.
- Existing account data is preserved.
- Existing offline state remains readable.
- Existing sync-engine registration continues to function.
- Existing table ownership and composition checks continue to work.

Keep logical schema-format versioning separate from database migration versions.

A change to the YAML schema grammar is not necessarily a database migration.

A database schema change must remain governed by the established migration process.

Do not require deleting local SQLite databases, wiping PostgreSQL, or resetting stored data.

Do not create new migration infrastructure if the existing one can be adapted.

---

## 11. Integration With Existing Application Composition

The repository already has established ownership for tables, schemas, and sub-manifests.

Preserve it.

The neutral schema definitions should produce native table descriptors that can be composed through the existing `SubManifest` and runtime registration system.

For example, Billing continues to expose its table collection to the appropriate composition root.

The runtime should not need to parse YAML in production to discover tables.

Prefer generated, statically checked objects and metadata.

Do not introduce another runtime registry or manually maintained table list.

### Important separation

A language-neutral database schema does not automatically authorize syncing that table to every device.

Preserve existing distinctions between:

- Database structure.
- Table ownership.
- Sync registration.
- Server-only data.
- Client-accessible data.
- Authorization.
- Subscription/replication policy.

Generating a Swift model for a table does not imply a Swift client may access that table.

Do not expose sensitive Billing, identity, or operational records simply because their schema definitions become language-neutral.

---

## 12. Code Generation Developer Experience

The authoring workflow should be extremely simple.

For example:

1. An agent adds or changes a table in the owning YAML file.
2. The generator validates the schema.
3. TypeScript definitions are generated.
4. Swift definitions are generated.
5. PostgreSQL and SQLite schema generation use the updated canonical model.
6. Existing schema checks and migration checks run.
7. CI verifies that generated outputs match the source.

The agent must not have to manually synchronize language-specific files.

Use existing repository build and task tooling.

Provide a canonical generation command through the established package scripts.

Do not introduce another monorepo task orchestrator.

### Generated-file discipline

Choose a clear checked-in versus build-generated artifact policy based on repository conventions, SwiftPM integration, and build reproducibility.

Whichever policy is selected must guarantee:

- Reproducible generation.
- No manual editing of generated output.
- Detectable schema drift.
- Stable package imports.
- Correct incremental builds.
- Complete dependency tracking.
- Reliable clean-checkout builds.
- No reliance on stale generated code.

Add generated-file headers identifying their authoritative source.

Do not let generation mutate source schema files.

Prefer generated immutable descriptors and native static types over loading YAML at application startup.

---

## 13. Test the Entire Schema Pipeline

The schema language and generator are framework infrastructure and require comprehensive automated verification.

### Specification validation

Test valid and invalid schema documents, including:

- Supported column types.
- Composite unique indexes.
- Missing indexed columns.
- Duplicate identifiers.
- Invalid identifiers.
- Unknown properties.
- Invalid metadata.
- Generator symbol collisions.
- Unsupported schema versions.

### Generation

Verify:

- Deterministic output.
- Stable public symbol names.
- Complete table collections.
- TypeScript compilation.
- Swift compilation.
- No stale generated artifacts.
- Correct source dependency tracking.

### Database equivalence

For the existing schema corpus, compare the old and generated outputs at the database level.

Include:

- Table names.
- Column names.
- Physical/logical types.
- Nullability.
- Defaults.
- Constraints.
- Index definitions.
- Unique constraints.
- Existing generated columns or metadata.

Use real disposable PostgreSQL and SQLite databases where required by established contract tests.

### Cross-language contracts

Verify equivalent interpretations across TypeScript and Swift.

Use shared test vectors for:

- Field names.
- Nullability.
- Integer values.
- Timestamps.
- Boolean values.
- Serialization.
- Table identifiers.
- Composite indexes.
- Naming transformations.

Do not claim parity from successful compilation alone.

### Existing application regression

Run affected schema, migration, sync-engine, and product tests.

In particular, ensure that the Billing schema migration is behaviorally identical to the existing version.

Use the existing Gherkin, property-based, and package-contract mechanisms where appropriate.

Preserve the repository's specification-first workflow.

---

## 14. Architecture and Naming Enforcement

Make the conventions machine-enforced.

Add or update existing architectural checks to prevent:

- New handwritten TypeScript product table definitions.
- Language-specific canonical schema sources.
- TypeScript packages without `-ts`.
- Swift packages without `-swift`.
- Language-neutral data packages incorrectly requiring runtime-specific imports.
- Duplicate schema ownership.
- Product-specific dependencies inside generic schema framework packages.
- Imports of generated implementation internals across unrelated packages.
- Manually maintained generated outputs.
- Generated artifacts that are missing or outdated.
- Unregistered source schemas.
- Multiple competing code-generation entry points.

Maintain clear distinction between language, runtime, and bounded-context ownership.

Do not apply language suffixes to purely language-neutral YAML/JSON specifications.

Do not create deeply nested generated folders or packages for individual tables.

Avoid broad package renames outside the affected schema architecture.

---

## 15. Keep the Framework Extensible Without Overengineering

This database schema framework is the first polyglot infrastructure component.

Its design will influence later migrations of:

- Mutation contracts.
- Query contracts.
- Sync-engine operations.
- Permissions.
- Game contracts.
- Client/server protocol messages.

Therefore, design its architecture so language-neutral inputs and language-specific generation are reusable patterns.

However, **do not build a universal code-generation framework during this task**.

The scope is database schema definitions.

A future schema generator should be able to follow the same principles without requiring this module to know about mutations, queries, game rules, or UI.

Avoid speculative plugin systems, code-generation DSLs, runtime interpreters, excessive package layers, and generic compiler infrastructure.

Use straightforward, conventional generation functions or emitters behind a small documented interface.

Adding a new target language should normally require a new emitter and runtime binding—not rewriting every domain schema.

---

## 16. Implementation Process

Execute the full change.

### Phase A — Repository audit

Inspect the existing db-schema framework, table-definition corpus, PostgreSQL/SQLite generators, migration tooling, schema snapshots, SubManifest integration, and all consumers.

Record the baseline and existing semantics.

### Phase B — Authoritative schema format

Define the language-neutral grammar and validation rules.

Establish canonicalization, naming, type mappings, and metadata semantics.

Update executable specifications first where required.

### Phase C — Code generator

Implement deterministic parsing, validation, canonical modeling, and output generation.

Implement TypeScript and Swift emitters.

Adapt the existing PostgreSQL and SQLite generation paths.

### Phase D — Migrate definitions

Convert the existing handwritten TypeScript table definitions into language-neutral schema files.

Update consumers to use generated TypeScript descriptors.

Generate native Swift models and descriptors.

Keep the migration complete and avoid leaving competing sources of truth.

### Phase E — Enforce architecture

Update package naming and dependency checks for the affected packages.

Prevent new handwritten canonical table definitions.

Add generated-code freshness checks.

### Phase F — Verify compatibility

Compare old/new schema output, execute database-level compatibility checks, compile TypeScript and Swift, and run affected sync/migration tests.

Prove no unintended database migration is introduced.

### Phase G — Cleanup and documentation

Remove obsolete authoring paths, unused imports, redundant abstractions, and transitional code.

Document the new table-authoring process and the language-emitter contract.

### Phase H — Complete validation

Run targeted package checks during development and the complete required repository validation.

Follow the existing `bun check-pr`, `bun check-nightly`, and spec-first commit conventions.

Fix failures introduced by the migration.

Do not disable tests, weaken assertions, introduce skipped checks, or bypass compatibility validation.

Do all work on the existing branch and worktree, following the repository's established commit and PR workflow. Subagents may be used for independent audits and implementation tasks.

Do not create a second branch or worktree or split the change into multiple unrelated PRs.

---

## 17. Acceptance Criteria

The refactor is complete only when:

### Language neutrality

- YAML or another deliberately selected language-neutral schema format is authoritative.
- Schema parsing and canonicalization do not require product-specific TypeScript declarations.
- TypeScript and Swift outputs are generated from the same canonical model.
- No manually duplicated schema definitions remain.
- Adding another language requires no edits to existing domain schemas.

### API quality

- Generated TypeScript objects preserve required existing API behavior.
- Generated Swift objects are native, typed, and idiomatic.
- Schema validation is strict and produces actionable errors.
- The authoring API is concise and opinionated.
- Generated symbols and serialization are deterministic.

### Database compatibility

- PostgreSQL and SQLite remain supported.
- Existing schema structure and metadata are preserved.
- Existing migrations and database history remain valid.
- No accidental schema changes occur during conversion.
- Offline-first synchronization remains functional.
- Database table ownership and access boundaries remain enforced.

### Package quality

- TypeScript packages end in `-ts`.
- Swift packages end in `-swift`.
- Language-neutral specification/data packages have no language suffix.
- Packages have flat source structures.
- No unnecessary per-table packages or deep folder trees are introduced.
- Existing package dependency restrictions remain valid.

### Developer experience

- A new table can be defined in one language-neutral specification.
- One generation command produces the necessary language-specific objects.
- No manual client/server type synchronization is necessary.
- Generated artifacts are reproducible.
- CI rejects stale outputs.
- Adding a new language follows an obvious, documented procedure.

### Correctness

- Schema validation tests pass.
- TypeScript generation and compilation pass.
- Swift generation and compilation pass.
- PostgreSQL/SQLite compatibility checks pass.
- A clean-checkout generation/build succeeds.
- Affected sync-engine and migration tests pass.
- Existing product behavior is preserved.

---

## 18. Final Deliverables

At completion, provide:

1. Final package structure and its ownership rationale.
2. The canonical schema specification format.
3. The generated TypeScript API.
4. The generated Swift API.
5. PostgreSQL and SQLite mapping guarantees.
6. Migration compatibility results.
7. Existing handwritten schemas converted.
8. Automated naming and architecture enforcement.
9. Code-generation commands and dependency integration.
10. Results of TypeScript, Swift, SQLite, PostgreSQL, and repository validation.
11. Remaining limitations or compatibility risks.
12. A concise example demonstrating how an agent adds one new table.

Also report any necessary deviations from the reference layout and why they improve the actual repository design.

## Final Directive

**This is the beginning of the product's polyglot architecture. Establish the right foundation now.**

The framework should be:

- Language-neutral at its source.
- Strongly typed in every generated language.
- Independent of product domains.
- Compatible with existing databases.
- Deterministic and reproducible.
- Extremely simple to author.
- Flat and cohesive in package structure.
- Extensible to future languages.
- Strictly validated.
- Fully integrated with existing tooling.

Do not preserve unnecessary TypeScript coupling merely because the current application is written in TypeScript.

Do not replace working database infrastructure for the sake of introducing another framework.

Do not overengineer a compiler or generic DSL beyond the actual schema requirements.

**The ultimate success criterion: defining a database table once is sufficient to produce correct, native schema objects for every supported language and consistent PostgreSQL/SQLite database behavior, with no handwritten duplication and no semantic drift.**
