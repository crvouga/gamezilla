# Polyglot repository

The product is one monorepo with one task graph and one CI system, in any number
of languages. This is the authoritative guide to how a language other than
TypeScript lives here. Swift is the first; Rust, Kotlin and Go have reserved
names and no toolchain yet.

What exists today is a foundation, not a second product: one portable Swift
package (`@pkgs/clock-shared-swift`) and one SwiftUI iOS shell
(`@apps/client-swift`) that shows the product name. There is no native
business logic, no game, no sync engine, no networking and no generated
contract in Swift yet.

## One orchestrator

Turborepo runs every build, check, test, lint and format task in every
language (AGENTS.md, "Turborepo is the only task runner"). Each language's
own tools do the specialised work underneath it:

| Concern | Owner |
| --- | --- |
| Task order, caching, what reruns after a change | Turborepo (`turbo.json`, package `turbo.json`) |
| JavaScript and TypeScript dependencies, workspace links | Bun (`bun.lock`) |
| Swift package dependencies | SwiftPM (`Package.swift`, `Package.resolved`) |
| Apple app builds, SDKs, simulators | Xcode (`<name>.xcodeproj`) |
| Toolchain versions | mise (`mise.toml`) |

Neither SwiftPM nor Xcode schedules repository work: a native package exposes
its tasks through a thin `package.json` whose scripts call a wrapper in
`libs/tools-harness-ts/scripts/`, and Turborepo decides when they run. A future Kotlin
package may use Gradle the same way, inside its own task.

## Every package declares its language

`package.json` is every package's manifest, whatever it is written in. The
fields next to `category` say what the package is; the manifest is
authoritative and the name is a convention checked against it.

```json
{
  "name": "@pkgs/clock-shared-swift",
  "private": true,
  "scripts": {
    "lint": "bun run ../../libs/tools-harness-ts/scripts/lint-package.ts",
    "tc": "bun run ../../libs/tools-harness-ts/scripts/swift-task.ts tc",
    "test": "bun run ../../libs/tools-harness-ts/scripts/swift-task.ts test"
  },
  "category": "isomorphic",
  "language": "swift",
  "platforms": ["linux", "macos", "ios"]
}
```

| Field | Values | Meaning |
| --- | --- | --- |
| `category` | `client`, `server`, `isomorphic`, `harness` | Where the code runs (README.md#repository). |
| `language` | `typescript`, `swift`, `neutral` (reserved: `rust`, `kotlin`, `go`) | The implementation language. `neutral` is a specification, schema or data package any implementation reads. |
| `platforms` | `linux`, `macos`, `ios` | What a native package builds for. Required for native languages; absent for TypeScript, which runs on Bun everywhere. |

The registry is `libs/tools-harness-ts/scripts/languages.ts` (languages, suffixes,
source extensions) and `libs/tools-harness-ts/scripts/package-hosts.ts` (platforms and
the hosts that build them). They are the only two lists.

## Names

A package is `<domain>-<feature>-<runtime>-<language>`: the domain and feature
say who owns it, the runtime suffix says where it runs, and the language
suffix comes last.

| Language | Suffix | Example |
| --- | --- | --- |
| TypeScript | `-ts` | `@libs/friends-root-client-ts` |
| Swift | `-swift` | `@pkgs/clock-shared-swift` |
| Rust | `-rust` | `@libs/friends-root-server-rust` |
| Kotlin | `-kotlin` | `@apps/android-client-kotlin` |
| Go | `-go` | |
| neutral | none | `@pkgs/sync-contracts`, `@libs/game-protocol` |

- An absent suffix never means TypeScript. Every TypeScript package ends in
  `-ts`, with no exemption: tooling is `@libs/tools-harness-ts`.
- A generator is code in the language it is written in: one written in
  TypeScript that emits Swift is `-ts`.
- Neutral packages hold portable definitions (YAML, JSON Schema, Protobuf,
  Gherkin) and end in no language suffix — and no runtime suffix, since they
  run nowhere.
- The scope is the tier directory and the rest of the name is the package's
  directory: `pkgs/clock-shared-swift` is `@pkgs/clock-shared-swift`. Apps
  name a product surface, so they carry no runtime suffix.

**Enforced by one gate.** `@libs/tools-harness-ts#ci:package-names`
(`libs/tools-harness-ts/scripts/package-names.ts`) checks every manifest at once: scope,
directory, kebab-case, runtime suffix, language suffix and unique names. It reads nothing but `package.json` files and its rules, so it
runs in milliseconds and is a cache hit whenever no manifest changed. Run it
with `bunx turbo run @libs/tools-harness-ts#ci:package-names`.

**Files.** Project-owned files and directories stay `lower-kebab-case`
(`root-view.swift`). Names a native tool mandates are the only exceptions, in
`NAMING_EXEMPT` (`libs/tools-harness-ts/naming/naming-rules.ts`): `Package.swift`,
`Package.resolved`, `Info.plist`, `Contents.json` inside an asset catalog, and
bundle directories whose stem stays kebab-case (`apple-client.xcodeproj`,
`assets.xcassets`).

## Boundaries

Each package's cached `lint` enforces them (`package-boundaries.ts`,
`language-boundaries.ts`), from the manifests and native project files rather
than from TypeScript imports:

- The tier pyramid holds in every language: `pkgs/` depend only on `pkgs/`
  and stay product-agnostic, nothing outside `apps/` depends on an app.
- A production dependency is in the same language or is language-neutral; a
  neutral package depends only on neutral ones. Implementations in different
  languages stay independent and meet through neutral contracts. Tooling may
  cross in `devDependencies` (a Swift package may build with a TypeScript
  generator).
- A package builds only for platforms its production dependencies build for.
- `Package.swift` `.package(path:)` entries and an Xcode project's
  `XCLocalSwiftPackageReference`s name exactly the Swift workspace packages
  `package.json` depends on. That one edge is in both graphs; neither can
  drift. A remote Swift dependency needs its `Package.resolved` committed.
- Native source stays flat in `src/`. A package that builds for Linux imports
  no Apple-only framework (`SwiftUI`, `UIKit`, `Combine`, …); isomorphic Swift
  imports no UI framework.
- A Swift app never compiles TypeScript, embeds a JavaScript runtime or wraps
  a web view: it is native.

## Toolchains

All pins are in `mise.toml`:

| Tool | Pin | Where it comes from |
| --- | --- | --- |
| Swift (Linux) | `[tools] swift` | mise, lazily: `mise exec` installs it (1.1 GB) the first time a Swift task runs, so nothing else downloads it. |
| Xcode (macOS) | `[vars] xcode_version` | Installed by you (`mise exec xcodes@latest -- xcodes install <version>` or developer.apple.com). Its Swift must equal the Linux pin. |
| iOS simulator | `[vars] ios_simulator_runtime`, `ios_simulator_device` | Ships with that Xcode (`xcodebuild -downloadPlatform iOS`). |

`libs/tools-harness-ts/scripts/native-toolchain.ts` finds them: an explicit
`DEVELOPER_DIR`, else the active developer directory, else the installed
`/Applications/Xcode*.app` whose version matches. Anything else is a failure
with the fix in its message (wrong Xcode, the Command Line Tools selected, a
Swift that differs from the pin, a missing simulator runtime). It never
substitutes another compiler. Bump Swift and Xcode together.

Check a machine with the tasks themselves:
`bunx turbo run tc --filter=@pkgs/clock-shared-swift` (Swift) and
`bunx turbo run build --filter=@apps/client-swift` (Xcode).

## Hosts

Turborepo knows nothing about operating systems; `package-hosts.ts` maps a
package's platforms to the hosts that can verify it.

| Work | Runs on |
| --- | --- |
| TypeScript tasks | Linux, macOS and Windows (CI: `ubuntu-24.04`) |
| Portable SwiftPM build and tests | Linux and macOS (CI: not checked) |
| SwiftUI iOS app build, launch and smoke test | macOS with the pinned Xcode only (CI: not checked) |

A wrapper on a host its package does not build for fails and says that the
check did not happen here and where its evidence comes from. An Apple app is
never reported built from Linux.

## Swift development

```bash
mise install                                        # Bun and the rest; Swift on Linux arrives lazily
bun install                                         # links the workspace, including native packages
bunx turbo run tc test --filter=@pkgs/clock-shared-swift
bunx turbo run lint --filter=@apps/client-swift
bunx turbo run build test --filter=@apps/client-swift   # macOS + Xcode only
bun fmt                                             # includes `swift format` over every Swift file
```

| Task | SwiftPM package | Xcode app |
| --- | --- | --- |
| `tc` | `swift build --build-tests` | — (`test` compiles) |
| `test` | `swift test`; fails if no test ran | `xcodebuild test` on a simulator created for the run and deleted after; fails unless the result bundle records passed tests |
| `build` | — | the app for the iOS Simulator, signed to run locally only |
| `lint` | naming, boundaries, native graph, `swift format lint --strict` | the same |

Builds go to the package's `.cache/` (gitignored), one directory per
toolchain and host. Open the app with `open
apps/client-swift/apple-client.xcodeproj`; the shared `apple-client`
scheme builds the `AppleClient` app and its UI smoke tests, and Xcode resolves
the local `clock-shared-swift` package by itself. The bundle identifier
(`external.appleBundleId` in
[`product-identity.json`](../libs/product-identity/product-identity.json))
is development-only and there is no signing team: nothing here can be
submitted to the App Store.

**Tests.** Pure package tests use Swift Testing in `tests/`; an app's
simulator smoke tests use XCTest UI testing in its `tests/`, finding views by
`accessibilityIdentifier` (`root-view`, `root-title`). Every Swift test is
deterministic: time is an injected `EpochClock` (`@pkgs/clock-shared-swift`,
the Swift form of `@pkgs/clock`), and `SystemEpochClock` is constructed only
at a composition root (`app-entry.swift`). Fixtures live beside the
tests in `tests/`. Shared Gherkin specs do not run against Swift yet; when
they do, they run through the existing harness architecture, not a second
runner.

## Adding a Swift package

1. `pkgs/<domain>-<feature>-<runtime>-swift/` (or `libs/`, `apps/`) with
   `package.json` as above: `language: "swift"`, `category`, `platforms`.
2. `Package.swift` (`swift-tools-version` at most the pinned Swift), targets
   `path: "src"` and `path: "tests"`, flat files.
3. `turbo.json` extending `//` with native inputs, copied from
   `pkgs/clock-shared-swift/turbo.json`: sources, `turbo-host-key.json` and
   the wrapper scripts; `outputs: []`; `DEVELOPER_DIR` and `HOME` passed
   through.
4. A dependent declares it in `package.json` `dependencies` **and** in its
   `Package.swift` or Xcode project. `lint` fails until the two agree.
5. `bun install`, then `bunx turbo run lint tc test --filter=<name>`.

An Xcode app package holds exactly one `<name>.xcodeproj` with a shared
`<name>` scheme, and uses `xcode-task.ts` for `build` and `test` (see
`apps/client-swift`).

## CI

Verify PR is still the one merge gate, and `verify:end` the one required
status; a pull request and Release both run the whole `release` gate. Every CI job runs on a standard GitHub-hosted `ubuntu-24.04` runner ([`CI_REQUIREMENTS.md`](CI_REQUIREMENTS.md#runner-operating-systems)),
so CI checks only what builds there.

- **The shards** run the gate over every package that declares no
  `platforms` (`turbo-ci-run.ts verify:ci`).
- **Native packages are not checked in CI.** The iOS app needs Xcode, which
  only a macOS runner has (ten times the free minutes), so `@pkgs/clock-shared-swift` and
  `@apps/client-swift` run only from explicit native verification on a host that builds them
  (Linux or macOS for the Swift package, a Mac with the pinned Xcode for the
  app). A pull request can break them and still pass `verify:end`.

Release and Health publish nothing native: no signing, TestFlight or store
submission exists.

Swift packages are reference implementations for now. Default `bun verify`,
`bun verify-nightly` and `bun lint` use the same portable package set as CI on
every host. `bun fmt` formats portable sources; `bun run fmt:swift` explicitly
formats Swift. To check native references, run
`bun libs/tools-harness-ts/scripts/turbo-ci-run.ts verify:macos` (or
`verify:linux` for that host), or name a native package with an explicit Turbo
filter. These opt-in commands require their pinned native toolchains.

## Caching

A native task's verdict holds for one operating system, CPU and toolchain:

- Native task inputs include `turbo-host-key.json` (gitignored, written by
  `turbo-ci-run.ts`: platform and architecture). Toolchain versions are in the
  hash through `mise.toml`, a global dependency, and the wrappers refuse to
  run on anything but those versions. `native-cache-keys.test.ts` proves that
  a host or toolchain change misses.
- A library's sources reach its dependents through `^src`: a change to
  `@pkgs/clock-shared-swift/src` reruns the app's `test`; a change to its own
  tests does not, and no TypeScript package reruns.
- No compiled native artifact is a Turbo output. SwiftPM and Xcode build
  output stays in each package's `.cache/`, keyed by toolchain and host, so a
  cache hit restores a verdict, never another machine's binaries. The app's
  `build` is `cache: false`.

## Generated code

The next step is a language-neutral `db-schema` with generated TypeScript and
Swift. None of it exists yet; when it lands it follows these rules:

- **Source:** a neutral package (`language: "neutral"`, no suffix) holds the
  declarative definitions.
- **Generator:** a package named for its implementation language
  (`…-ts`), depending on the source package.
- **Outputs:** generated code lives in the language package that owns it (a
  `…-ts` package and a `…-swift` package), in a generated directory of its
  own. Each output package has a package-owned `generate` task that
  `dependsOn` the generator, declares the source package as `inputs` and its
  generated directory as `outputs`, so a schema change reruns the generator,
  both outputs and their consumers, and nothing else.
- **Freshness:** generated files are derived and gitignored, written by `bun
  install` (`postinstall` → `bun run generate`), as the step catalogs and
  Lingui catalogs are (AGENTS.md "Concurrent worktrees never share a hot
  file"). Nobody edits them; a generated file starts with a header naming its
  source and generator. Where a native build needs them in the tree (an Xcode
  project opened directly), the `generate` task writes them before any task
  that compiles them.

## Adding a language

1. **Register it.** Mark it `supported` in `languages.ts` (its suffix and
   source extensions are already reserved), add any new platform to
   `package-hosts.ts`.
2. **Pin its toolchain** in `mise.toml` (lazy, if large, and restricted to
   the operating systems that build it).
3. **Write its thin wrappers** in `libs/tools-harness-ts/scripts/` (`<language>-task.ts`):
   find the pinned toolchain, refuse an unsupported host, invoke the native
   tool, fail when no test ran. No scheduling, no dependency graph.
4. **Add the package** with its native manifest and the thin `package.json`
   (`language`, `category`, `platforms`, standard task names).
5. **Extend the boundaries**: its native dependency references in
   `language-boundaries.ts` (as for `Package.swift`), its formatter in
   `lint-package.ts`, its test runner in `test-scripts.ts`.
6. **Expect no CI.** CI runs on GitHub-hosted `ubuntu-24.04` and verifies only packages
   without `platforms` (`ciFilters` in `package-hosts.ts`); a native package
   is verified only by explicit host or package commands on a host that builds it.
7. **Prove it** with tests beside the ones above (`language-boundaries.test.ts`,
   `native-cache-keys.test.ts`), then update this guide.

There is never a second build system, CI architecture or package registry.
