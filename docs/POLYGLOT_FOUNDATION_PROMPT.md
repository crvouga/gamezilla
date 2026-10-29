# Foundational Polyglot Monorepo & Swift Integration

## Mission

Transform the product's existing TypeScript-only Turborepo into a **first-class polyglot monorepo** capable of supporting TypeScript, Swift, Rust, Kotlin, and other languages over the lifetime of the product.

This is a foundational engineering task.

We are not migrating business logic, implementing new games, or building a complete native application yet.

The immediate deliverables are:

1. A clear, enforceable polyglot repository architecture.
2. Consistent package naming, language metadata, dependency boundaries, and development conventions.
3. Swift integrated as a first-class supported language.
4. A minimal, compilable, launchable SwiftUI iOS application shell.
5. Native Swift tooling integrated with the existing Turborepo task graph.
6. Automated Swift compilation, formatting, testing, and validation through the existing CI system.
7. Correct cross-platform toolchain, dependency, caching, and operating-system handling.
8. Agent-friendly documentation describing how to add packages, clients, and future languages.

**Turborepo must remain the single task orchestrator for every language and every CI task.**

Bun remains the existing JavaScript package manager and application runtime where currently used.

Swift Package Manager manages native Swift dependencies.

Xcode provides the Apple application compiler, SDKs, simulator, and platform tooling.

Neither SwiftPM nor Xcode may become a competing repository-level task orchestrator.

The goal is to establish a **small, opinionated, reliable polyglot foundation** that future agents can extend without repeatedly redesigning repository conventions.

Do not stop at configuration or recommendations. Implement the working foundation end to end.

---

## 1. Architectural Principles

Adopt the following non-negotiable principles.

### One monorepo

Maintain one repository, one workspace architecture, one dependency-aware task graph, and one unified CI process.

All languages participate in the existing Turborepo architecture.

Do not create separate Swift repositories or an independently maintained Apple application workspace outside the monorepo.

### One task orchestrator

All standard build, check, test, lint, format, and code-generation tasks must be discoverable and runnable through Turborepo.

Native compilers and package managers remain responsible for their own specialized operations.

For example:

- Turbo orchestrates a Swift compilation task.
- SwiftPM compiles a Swift package.
- Turbo orchestrates an iOS build task.
- Xcode builds the iOS application.
- Turbo orchestrates TypeScript compilation.
- The existing TypeScript tooling compiles TypeScript.

Do not introduce Nx, Bazel, Gradle as a global orchestrator, Make as a competing build graph, or another cross-language task system.

Future Kotlin projects may use Gradle internally, just as Swift uses SwiftPM internally.

### Language independence

Repository structure, task discovery, architectural checks, CI policy, and package ownership must not fundamentally assume every package contains TypeScript.

Every package must explicitly declare the information required to understand its language, runtime, build requirements, and dependency boundaries.

### Opinionated conventions

There must be one obvious, documented way to introduce a new package or language.

The easiest integration path must follow the correct conventions automatically.

Avoid multiple competing approaches.

### Incremental adoption

Preserve the existing TypeScript application and all existing functionality.

Do not rename hundreds of TypeScript packages merely to establish the new convention.

Support a deliberate incremental transition from existing names to the new convention without letting temporary legacy exceptions become permanent defaults.

### Minimal architecture

Do not build speculative general-purpose tooling or introduce unnecessary packages.

Establish only the abstractions needed to support today's TypeScript repository, the new Swift application, and clean future language additions.

---

## 2. Audit the Existing Repository First

Before implementing, inspect:

- `AGENTS.md` and the repository briefing.
- Root `package.json`.
- Bun workspace configuration and lockfile.
- `turbo.json` and package-specific Turbo configuration.
- `mise.toml` and existing toolchain management.
- `apps/`, `libs/`, and `pkgs/`.
- Package manifests and runtime categories.
- Existing naming and package-boundary enforcement.
- The Check PR and Check Nightly implementations.
- Current CI task discovery, scheduling, caching, fingerprints, and platform assumptions.
- Existing development tooling, scripts, and documentation.
- Current code-generation infrastructure, if any.

Determine which parts already support multiple languages and which incorrectly assume TypeScript.

Identify the smallest changes necessary to establish real Swift integration.

Preserve established functionality and conventions wherever they remain appropriate.

Do not replace a working mechanism merely because another architecture is possible.

---

## 3. Establish Formal Package Naming Conventions

Adopt the following naming convention for polyglot packages:

`<domain>-<feature>-<runtime>-<language>`

The domain and feature describe ownership.

The runtime describes execution context.

The language identifies the implementation.

The runtime and language dimensions may be omitted only when they genuinely do not apply.

### Language suffixes

Require these conventions for new language-specific packages:

| Language | Required suffix |
|---|---|
| TypeScript | `-ts` |
| Swift | `-swift` |
| Rust | `-rust` |
| Kotlin | `-kotlin` |
| Go | `-go` |

Support a declarative mechanism for future language identifiers without requiring another naming-system rewrite.

### Language-neutral packages

Language-neutral specification or data packages omit the language suffix.

Examples include:

```text
game-protocol
game-contracts
db-schema
sync-contracts
```

A directory with YAML, JSON Schema, Protobuf, Gherkin, or other portable definitions can be language-neutral.

A code generator implemented in TypeScript is still TypeScript code and therefore uses `-ts`, even if it generates Swift, Rust, or Kotlin.

Do not use an absent language suffix to implicitly mean TypeScript.

### Runtime categories

Preserve the existing runtime vocabulary:

- `client`
- `server`
- `shared`
- Existing harness/tooling categories where applicable.

Put the language suffix last.

Examples:

```text
friends-root-client-ts
friends-root-client-swift

friends-root-server-ts
friends-root-server-rust

game-rules-shared-ts
game-rules-shared-swift

sync-engine-root-shared-ts
sync-engine-root-shared-swift
```

These are naming examples, not instructions to rename existing packages during this task.

### Existing TypeScript packages

The current repository contains established packages without a `-ts` suffix.

Do not perform a sweeping renaming migration.

Instead:

1. Inventory the existing packages.
2. Establish the new naming policy for newly created packages.
3. Preserve existing names through an explicit, frozen legacy baseline.
4. Prevent new violations from entering the repository.
5. Document how existing packages can be migrated incrementally.
6. Ensure legacy exceptions cannot grow silently.

The long-term convention is explicit language suffixes.

Do not introduce another generation of ambiguous package names.

### Naming enforcement

Extend the existing naming and package validation tooling.

Do not create a competing linter.

Preserve lowercase kebab-case for project-owned source files and directories.

Recognize mandatory ecosystem filenames and structures such as:

- `Package.swift`
- `Package.resolved`
- Xcode project/workspace files.
- `Info.plist`.
- Asset catalogs and their required metadata.

Document and enforce narrowly scoped exceptions for standard native tooling requirements.

---

## 4. Make Package Metadata Language-Aware

Extend the existing package manifest metadata rather than creating a second package registry.

Each package should provide sufficient metadata to determine:

- Package identity.
- Ownership.
- Language.
- Runtime category.
- Supported platforms where relevant.
- Toolchain requirements.
- Architectural dependency restrictions.
- Its registered Turbo tasks.

Conceptually:

```json
{
  "name": "@apps/apple-client-swift",
  "private": true,
  "product": {
    "language": "swift",
    "runtime": "client",
    "platforms": ["ios"]
  }
}
```

This is illustrative. Adapt it to the actual manifest schema and repository conventions.

Do not invent incompatible metadata fields if the existing package manifest system already has an appropriate extension mechanism.

### Important

**Manifest metadata is authoritative. Directory naming is a validated convention, not the sole source of architecture metadata.**

Ensure the system can distinguish:

- Native packages.
- TypeScript packages.
- Language-neutral schema packages.
- Build-tooling packages.
- Platform-restricted applications.
- Cross-platform libraries.

Do not assume that `package.json` implies the implementation language is JavaScript.

---

## 5. Establish Native Workspace Integration

Swift projects must participate directly in the existing Bun workspace and Turborepo package graph.

Use thin workspace manifests to expose native tasks to Turbo.

For example:

```json
{
  "name": "@apps/apple-client-swift",
  "private": true,
  "scripts": {
    "build": "bun run scripts/build.ts",
    "test": "bun run scripts/test.ts",
    "lint": "bun run scripts/lint.ts"
  }
}
```

This is conceptual. Choose scripts and tooling appropriate to the actual repository, and ensure source-script packages follow the language naming convention.

Native task wrappers should be extremely thin.

They may:

- Check platform prerequisites.
- Locate the configured toolchain.
- Construct deterministic compiler arguments.
- Invoke native tooling.
- Normalize exit codes.
- Report actionable errors.

They must not duplicate a task scheduler or independently coordinate dependency graphs already owned by Turbo.

### Dependency management

Maintain a clear distinction:

- Bun owns JavaScript/TypeScript dependencies.
- SwiftPM owns Swift package dependencies.
- Xcode owns Apple application builds and SDK integration.
- Turbo owns cross-package task relationships.

Where a Swift application depends on a local Swift package, represent that dependency correctly in SwiftPM/Xcode and in Turbo's dependency/task graph.

Do not create multiple conflicting versions of the dependency graph.

Use explicit task dependencies where native package relationships cannot be inferred automatically.

Prevent circular dependencies and hidden cross-language imports.

---

## 6. Add a Minimal SwiftUI Client Shell

Create one native Apple client application.

Preferred illustrative location:

```text
apps/
  apple-client-swift/
    package.json
    apple-client.xcodeproj/
    src/
      app-entry.swift
      root-view.swift
    tests/
      app-smoke-tests.swift
```

Adapt names and layouts to existing repository conventions.

Keep project-owned source files flat.

Native project and asset formats may use their required structural directories.

### Required application

Implement a minimal working iOS application using:

- Swift.
- SwiftUI.
- A standard Xcode project.
- A committed, discoverable build scheme.
- The existing repository's toolchain conventions.

The initial screen may simply display the product name with an otherwise empty application surface.

The application must:

- Compile successfully.
- Launch in an iOS Simulator.
- Display its minimal initial screen.
- Use normal SwiftUI application lifecycle constructs.
- Support appropriate accessibility identifiers for automated smoke testing.
- Build without production signing credentials.
- Have a reproducible, documented development configuration.

Use a development-only bundle identifier and signing configuration where necessary. Inspect existing organizational conventions before choosing identifiers.

Do not invent production App Store identities, credentials, teams, or provisioning profiles.

### Keep the app genuinely minimal

Do not implement:

- Authentication.
- Profiles.
- Matchmaking.
- Game screens.
- Chess or Connect Four.
- Networking.
- SQLite persistence.
- Sync engine behavior.
- Billing.
- Feature parity with the TypeScript app.
- A second game framework.

This is a **native integration shell**, not a second production client.

Its purpose is to prove that Apple application development is a first-class part of the repository.

### Future macOS support

Structure the SwiftUI source so future iPadOS and macOS targets can share it.

Prefer Apple's standard multiplatform architecture.

However, prioritize one working iOS target. Do not expand this task into implementing and testing a complete macOS application unless adding an empty macOS target is trivial and does not complicate CI.

---

## 7. Establish Swift Package Manager Conventions

Define how reusable Swift packages will live inside this repository.

Prefer a small, focused SwiftPM package for reusable native client foundations if doing so provides a meaningful test of native package linking and cross-platform compilation.

For example:

```text
pkgs/
  client-foundation-shared-swift/
    package.json
    Package.swift
    src/
      client-foundation.swift
    tests/
      client-foundation-tests.swift
```

Configure SwiftPM target source paths to preserve the repository's flat-source preference where supported.

The SwiftUI shell should be able to import a local Swift package through normal package dependencies.

Keep the package limited to useful foundational contracts or client setup concepts.

Do not introduce arbitrary placeholder domain models merely to populate the directory.

### Swift package requirements

- Explicit Swift tools-version compatibility.
- Stable package and module naming.
- Clear public exports.
- Explicit dependencies.
- Tests using supported native tooling.
- No runtime dependency on TypeScript.
- No dependency on product code from generic `pkgs/`.
- No accidental importing of SwiftUI into code intended for platform-neutral Swift execution.

The conventions must allow future generated Swift contracts to be placed into appropriate native packages without changing the entire workspace structure.

Do not implement the database schema generator yet.

---

## 8. Toolchain Management and Reproducibility

Extend the existing toolchain setup to support Swift and Xcode.

Preserve Bun, TypeScript, and all established tooling.

### Swift

Select an appropriate stable Swift toolchain compatible with the chosen Xcode and SwiftPM configurations.

Record toolchain expectations in the existing repository tool-management system.

Where useful, validate:

- `swift --version`
- `swift package --version`
- `xcodebuild -version`
- Required SDK availability.
- Apple Simulator availability.

Do not assume the standalone Swift toolchain can replace Xcode for Apple application builds.

### Platform requirements

Make operating-system requirements explicit.

| Task | Supported execution |
|---|---|
| TypeScript builds/tests | Existing supported platforms |
| Portable SwiftPM builds/tests | Linux and macOS where dependencies permit |
| SwiftUI iOS app build | macOS with Xcode |
| iOS simulator tests | macOS with Xcode and simulator runtime |
| Future Rust/Kotlin tasks | Their supported platforms |

A Swift library should be Linux-compatible when its actual responsibilities are platform-neutral.

SwiftUI code is inherently Apple-platform-specific and should not be required to compile under Linux.

Do not make unrelated Linux tasks fail because Xcode is unavailable.

Equally, do not report an iOS application as successfully verified when only Linux Swift compilation was performed.

### Missing tools

Toolchain failures should produce specific actionable messages.

For example:

- Required Xcode version unavailable.
- Swift compiler missing.
- Unsupported Swift tools version.
- Missing simulator runtime.
- Incorrect active developer directory.
- Incompatible SDK.

Do not silently substitute a different compiler or skip required checks.

### Reproducible dependencies

Use existing lockfiles and SwiftPM's supported dependency-resolution mechanisms.

Commit native dependency resolution data where appropriate for reproducible builds.

Do not automatically update native dependencies during ordinary CI runs.

---

## 9. Integrate All Swift Tasks Into Turborepo

Use the existing Turbo task architecture.

Expose suitable package-owned tasks for:

- Build.
- Type checking or compile validation.
- Tests.
- Formatting.
- Linting.
- Dependency validation.
- Native application smoke testing.

Use the repository's existing naming conventions where they already define equivalent tasks.

Avoid duplicating tasks that do the same work.

### Example commands

The intended developer experience should resemble:

```bash
bunx turbo run build --filter=@apps/apple-client-swift

bunx turbo run test --filter=@pkgs/client-foundation-shared-swift

bunx turbo run lint --filter=@apps/apple-client-swift
```

Package names are illustrative; adapt to the final package structure.

The same functionality must participate in the ordinary repository checks.

### Task graph

Ensure Turbo knows:

- Which Swift packages depend on other Swift packages.
- Which Apple app builds depend on local Swift libraries.
- Which generated contracts future native packages will consume.
- Which checks can run in parallel.
- Which checks must run on macOS.
- Which tasks can be cached safely.

Do not use root scripts that sequentially invoke all language toolchains independently of Turbo.

### Task outputs

Configure inputs and outputs carefully.

Account for:

- Swift sources and tests.
- `Package.swift`.
- `Package.resolved`.
- Xcode project/build settings.
- Toolchain declarations.
- Asset catalogs.
- Native code-generation inputs where applicable.
- The selected build configuration and platform.
- Native dependency changes.

Do not reuse compiled native artifacts across incompatible operating systems, CPU architectures, SDK versions, Xcode versions, or Swift compiler versions.

If reliable cache isolation cannot be established initially, disable caching for the affected native artifact-producing task until it can be demonstrated safe.

Prefer correctness over misleading cache hits.

---

## 10. Preserve and Extend Existing CI

The repository already has established Check PR, Check Nightly, Release, and Health workflows.

**Preserve those workflows. Do not create a separate Swift CI architecture.**

Extend the existing task discovery and execution infrastructure so native packages participate appropriately.

### Check PR

The existing `bun check-pr` remains the primary validation interface.

Add bounded Swift verification covering the new Swift packages and the application shell.

Include:

- Swift package compilation.
- Swift package tests.
- Swift formatting/linting checks where supported.
- Native package dependency/boundary checks.
- iOS application compilation on macOS.
- A minimal iOS smoke test where practical.

Use Turbo to invoke all package tasks.

### macOS CI

Apple app compilation requires a macOS environment with Xcode.

Integrate a macOS execution lane into the existing Check PR architecture rather than pretending it can run on an Ubuntu runner.

Prefer hosted macOS runners initially to avoid introducing new machines or operational dependencies.

Keep this lane bounded and cost-conscious.

Only run expensive Apple-specific verification when the relevant inputs, dependencies, or toolchain configuration change, provided the dependency tracking correctly identifies every change requiring revalidation.

Changes to shared contracts consumed by Swift must also invalidate the relevant Swift checks.

### Gate integrity

The existing final merge/release verdict must account for required native validation.

A missing, failed, or unexecuted required macOS task must not be treated as a passing result.

Preserve existing workflow status semantics and release protection.

Do not treat an unsupported local platform as equivalent to successful validation.

Where the local machine cannot run an Apple-specific check, report that limitation and require the corresponding macOS CI evidence before the change is considered fully verified.

### Check Nightly

Use the existing comprehensive profile for deeper native checks where justified.

Appropriate future checks include:

- Simulator launches.
- Additional device configurations.
- UI tests.
- Screenshots and interaction tests.
- Native performance measurements.
- Cross-language conformance.

For this foundational change, keep comprehensive native testing minimal and focused on proving that the shell actually builds and starts.

Do not implement a second native visual testing framework yet.

### Release and Health

Preserve existing release and health behavior.

Do not publish the new Swift application to the App Store.

Do not introduce signing credentials, deployment certificates, TestFlight automation, store submissions, or new production endpoints.

Native delivery can be designed as a later, separate task.

---

## 11. Establish Swift Formatting and Testing Conventions

Use idiomatic Swift conventions without conflicting with repository-level standards.

### Code style

- Strong typing.
- Small cohesive types.
- Explicit visibility.
- Swift concurrency conventions.
- Value semantics where appropriate.
- Minimal global mutable state.
- Explicit error handling.
- Testable dependency boundaries.
- No unnecessary singleton services.

Prefer standard Swift tooling.

Use a stable Swift formatting solution supported by the selected toolchain.

Do not introduce several overlapping formatters and linters.

### Tests

Use Swift Testing where appropriate and existing Xcode testing infrastructure for Apple-specific integration.

Tests should be deterministic and runnable without manual Xcode interaction.

Establish conventions for:

- Pure Swift package tests.
- Apple application smoke tests.
- Test fixtures.
- Generated code tests.
- Future cross-language conformance tests.

Do not create a new Gherkin runner for Swift yet.

Later, shared executable specifications should be able to run against Swift implementations through the existing harness architecture.

### Keep tests meaningful

A test that only asserts `true` is not useful evidence.

The initial tests should prove:

- A Swift package's public API can be imported and used.
- The intended package/module dependency is valid.
- Native compilation works through the Turbo task.
- The blank app builds and launches.
- The expected root view is present when tested through a simulator.

Keep the smoke suite small.

---

## 12. Enforce Architectural Boundaries Across Languages

The current repository already enforces package boundaries for TypeScript.

Extend architectural validation to understand native packages.

### Core rules

- `pkgs/` packages remain product-agnostic.
- `libs/` packages may contain product-specific integrations.
- `apps/` compose the application.
- Native packages must respect corresponding dependency boundaries.
- Swift packages must not import unrelated product packages through undocumented paths.
- Swift and TypeScript implementations remain independent.
- Language-neutral contracts must not import language-specific implementations.
- Production packages must not depend on test harness packages.

Inspect native package manifests and project dependencies instead of relying exclusively on TypeScript import analysis.

Use existing package-boundary infrastructure where practical.

### No hidden coupling

Do not introduce a native application that depends on TypeScript source code merely to compile.

Do not duplicate product business rules inside the blank Swift shell.

Do not create an embedded JavaScript runtime or WebView as a substitute for native Swift integration.

The native shell should be genuinely native.

Its future integration with the product's backend and contracts must occur through the intended language-neutral interfaces.

---

## 13. Prepare for Future Language-Neutral Code Generation

The next planned migration will make the `db-schema` framework language-neutral through declarative schemas and generated TypeScript/Swift objects.

This task must establish the repository foundation that will make such migrations straightforward.

However, **do not implement that database schema migration now**.

Instead, define the conventions future generators will follow.

### Source packages

Language-neutral schemas live in packages without language suffixes.

### Generator packages

Generators are named according to their implementation language.

For example, a TypeScript-based generator ends in `-ts`.

### Generated outputs

Generated code belongs to clearly identified language-specific packages or output targets.

A generator must be able to produce Swift or TypeScript outputs without manually copying files between repositories.

### Dependency tracking

Generated-code tasks must later participate in Turbo's task graph.

A schema change should invalidate:

- The relevant generator execution.
- The affected generated TypeScript outputs.
- The affected generated Swift outputs.
- The consumers depending on those outputs.

Unrelated packages should remain cacheable.

### Generated-code verification

Establish a convention for enforcing freshness, reproducibility, source ownership, and no manual edits.

Do not create placeholder schema compilers, generated business objects, or mock protocol definitions during this task.

The foundation should be ready for the subsequent implementation, not attempt to implement it prematurely.

---

## 14. Agent-Friendly Documentation

Update existing architectural and agent guidance to explain the polyglot repository.

Document:

### Repository architecture

- Why Turborepo remains the sole task orchestrator.
- How native packages participate in Bun workspaces.
- Which tool manages dependencies for each language.
- Language-specific versus language-neutral packages.
- Package naming and metadata.
- Runtime and platform distinctions.

### Adding a language

Provide a concise formula for adding future Rust, Kotlin, or other language support.

The process should normally involve:

1. Registering the language/toolchain.
2. Adding the native package.
3. Adding the thin Turbo workspace manifest.
4. Declaring dependency and platform metadata.
5. Exposing standard tasks.
6. Integrating required CI runners.
7. Adding appropriate tests and architecture checks.

Do not require building a new repository-level build system.

### Swift development

Document:

- Toolchain installation and validation.
- Native package creation.
- Xcode project location.
- Build and test commands.
- How to open the application in Xcode.
- How to run checks through Turbo.
- Linux versus macOS capabilities.
- Required CI evidence.
- Current shell limitations.

### Future code generation

Document the language-neutral source → generated target convention.

Clarify that native client business logic and shared game contracts have not yet been implemented.

### Documentation discipline

Update the existing repository briefing and agent-facing materials, including `AGENTS.md` or `llms.txt` where applicable.

Do not duplicate large amounts of content across several documentation files.

Prefer concise references to one authoritative polyglot architecture guide.

---

## 15. Eliminate Relevant Tooling Anti-Patterns

Audit and prevent:

- Scripts that assume every workspace package contains TypeScript.
- Tasks that call multiple independent build orchestrators.
- Untracked native dependencies.
- Swift build commands disconnected from Turbo.
- CI checks that silently skip unsupported platforms.
- Native cache reuse across incompatible toolchains.
- Hardcoded local Xcode installation paths.
- Machine-specific absolute paths committed to source.
- Unpinned dependency or toolchain versions.
- Package naming inferred only from directory strings.
- Native libraries depending on unrelated application internals.
- Duplicate language registries.
- Generated-code systems with manually synchronized outputs.
- Unnecessary native framework abstractions.
- Empty placeholder packages created for hypothetical future architectures.
- A second set of CI commands unrelated to the existing check gates.

Solve these through the existing tooling wherever possible.

Do not expand the task into a general cleanup of unrelated TypeScript packages.

---

## 16. Implementation Process

Perform all work in the existing branch and worktree, respecting the repository's established workflow.

Keep the change in one coherent PR.

Subagents may be used for independent audit, build setup, testing, or documentation.

### Phase A — Audit

Inspect the repository and determine the minimum polyglot integration design.

Document the intended package ownership and execution constraints.

### Phase B — Conventions

Implement language metadata, naming rules, architecture checks, and the required legacy-package handling.

### Phase C — Swift toolchain

Configure Swift and Xcode toolchain expectations.

Establish reproducible native dependency management and clear platform diagnostics.

### Phase D — Native packages

Add the minimal SwiftPM package integration needed to prove native module builds and tests.

Expose its tasks through Turbo.

Avoid unnecessary placeholder architecture.

### Phase E — SwiftUI shell

Create the blank native iOS application.

Wire its actual native dependencies and ensure the app compiles and launches.

### Phase F — Turbo integration

Register native build, lint, test, and validation tasks.

Configure dependencies, platform requirements, and safe caching behavior.

### Phase G — CI integration

Extend the existing Check PR and relevant Check Nightly infrastructure.

Verify that macOS checks actually execute when required and participate in the release verdict.

### Phase H — Documentation

Update the repository's package-authoring, polyglot, and agent instructions.

### Phase I — Validation

Run the relevant package-specific checks and full required repository validation.

Verify the native build on an actual macOS/Xcode environment.

Fix all failures introduced by the changes.

Do not report an iOS build as passing unless it was genuinely built.

---

## 17. Required Verification

The implementation must provide evidence for the following.

### Workspace discovery

The native Swift application and reusable Swift packages appear as ordinary discoverable Turbo workspace packages.

### Task execution

Turbo can invoke:

- Native Swift package compilation.
- Native Swift tests.
- Native lint/format checks.
- The SwiftUI application build.

### Dependency correctness

A change to a native library invalidates the native application tasks that depend on it.

Unrelated TypeScript packages do not unnecessarily rebuild.

### Toolchain behavior

Unsupported platforms produce clear diagnostics or select only their valid task subsets.

Apple-specific verification is performed on macOS and cannot silently disappear.

### Native application

The iOS shell compiles and launches in a simulator.

It shows the intended minimal root view.

### CI

The existing Check PR gate accounts for required Swift verification.

Native failures produce a failing verdict.

Existing TypeScript checks remain functional.

### Naming

Valid new package names pass.

Invalid language suffixes fail.

Language-neutral packages remain distinguishable.

Legacy exceptions are limited to the established baseline.

### Clean checkout

A clean checkout can restore dependencies and execute the supported build and test tasks using the documented toolchains.

No manually generated files, uncommitted project settings, or local IDE modifications are required.

---

## 18. Definition of Done

Do not consider the task complete until:

- [ ] Turborepo remains the single repository-wide task orchestrator.
- [ ] The existing TypeScript application and CI remain functional.
- [ ] Swift is a first-class supported implementation language.
- [ ] Package metadata explicitly distinguishes languages and runtimes.
- [ ] New language-specific package naming conventions are enforced.
- [ ] Language-neutral packages have a clear naming and ownership convention.
- [ ] Existing TypeScript packages remain compatible without a mass rename.
- [ ] SwiftPM integrates correctly into the workspace.
- [ ] A native SwiftUI iOS application shell exists.
- [ ] The iOS shell compiles and launches.
- [ ] The necessary Swift package tests execute through Turbo.
- [ ] Native build tasks have correct dependencies and platform requirements.
- [ ] Native caching does not permit invalid cross-platform reuse.
- [ ] The existing CI architecture includes required macOS verification.
- [ ] Missing native validation cannot silently pass.
- [ ] Future generators have documented source/output integration conventions.
- [ ] No unrelated game or business logic was implemented.
- [ ] No unnecessary infrastructure or task orchestrator was introduced.
- [ ] Documentation allows a fresh agent to add another native package correctly.
- [ ] All required validation passes, or unsatisfied gates are reported explicitly.

---

## 19. Final Engineering Report

At completion, report:

1. Final polyglot package architecture.
2. New naming and manifest conventions.
3. Swift toolchain and supported versions.
4. SwiftPM integration.
5. SwiftUI shell location and supported target platforms.
6. Turbo task names and commands.
7. Native dependency and cache configuration.
8. CI modifications and platform-specific validation.
9. Architecture and naming enforcement.
10. Actual build and test results.
11. Documentation updated.
12. Remaining limitations and next recommended integration step.

Clearly distinguish verified work from planned future capabilities.

Do not claim that the framework already supports Swift business logic, game rules, offline synchronization, or generated database schemas merely because the application shell compiles.

## Final Directive

**Make this repository a first-class polyglot Turborepo without sacrificing the simplicity, reliability, and speed of the existing TypeScript development experience.**

The desired architecture is:

- One monorepo.
- One task graph.
- One CI system.
- Explicit language and platform metadata.
- Native dependency management within each language.
- Language-neutral contracts as future shared sources of truth.
- Deterministic generated code where appropriate.
- Thin, independently implemented native clients.
- Clear and enforceable conventions for agents.

Do not build a second product, rewrite existing frameworks, or introduce speculative abstractions.

**The immediate success criterion is simple: a fresh agent can add and validate a Swift package or SwiftUI application in the existing Turborepo as naturally as it can add a TypeScript package—without creating another build system, another CI architecture, or unnecessary maintenance burden.**

Implement the entire foundational integration and verify it.
