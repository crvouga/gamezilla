'use strict';

/**
 * Framework-agnostic core (grows per port phase). Files here must not import
 * any UI framework — including solid-js.
 */
const coreScope = require('./libs/tools/port/core-scope.json');

const scopeToPathRegex = (scope) =>
  `^(${[...scope.dirs.map((dir) => `${dir}/`), ...scope.files]
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})`;
const coreScopePath = scopeToPathRegex(coreScope);

const SOLID_STACK_PATH =
  'node_modules/(solid-js|@solidjs/[^/]+|@lingui/solid|lucide-solid|@tanstack/solid-[^/]+)/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-no-framework',
      severity: 'error',
      comment:
        'Framework-agnostic core must not import solid-js. See libs/tools/port/core-scope.json.',
      from: { path: coreScopePath },
      to: { path: `(${SOLID_STACK_PATH})` },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-test-from-prod',
      severity: 'error',
      from: {
        pathNot: '(\\.test\\.|\\.spec\\.|/tests/|/e2e/)',
      },
      to: {
        path: '(\\.test\\.|\\.spec\\.|/tests/|/e2e/)',
        pathNot: 'smoke-tests',
      },
    },
    // Shared cannot reach into any runtime-specific code, anywhere in the repo
    // (pkgs triad src/shared and libs use-cases/*/shared + src/shared).
    {
      name: 'shared-pure',
      severity: 'error',
      from: {
        path: '(/src/shared/|/use-cases/[^/]+/shared/)',
      },
      to: { path: '/(client|server)/' },
    },
    // Within and across feature packages, client and server are isolated
    // (pkgs src/client, use-cases/*/client, root/client).
    {
      name: 'client-not-server',
      severity: 'error',
      from: {
        path: '/client/',
        pathNot: '(\\.test\\.|\\.spec\\.|/tests/|/e2e/)',
      },
      to: { path: '/server/' },
    },
    {
      name: 'server-not-client',
      severity: 'error',
      from: { path: '/server/' },
      to: { path: '/client/' },
    },
    {
      name: 'no-non-package-json',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'assistant-no-internal',
      severity: 'error',
      comment:
        'Only @pkgs/assistant/shared and @pkgs/assistant/client are importable from outside the assistant package.',
      from: { pathNot: '^pkgs/assistant/' },
      to: { path: '^pkgs/assistant/src/(shared|client)/internal/' },
    },
    {
      name: 'not-to-dev-dep-from-src',
      severity: 'error',
      from: {
        path: '^(apps|libs|pkgs)/[^/]+/src/',
        pathNot: '(\\.test\\.|\\.spec\\.|/tests/|/e2e/)',
      },
      to: { dependencyTypes: ['npm-dev'] },
    },
    // Tier import pyramid: apps -> apps, libs, pkgs; libs -> pkgs; pkgs -> pkgs.
    // apps/product is the composition hub inside apps/ (sim fabric + console +
    // test harness); it may compose other apps. libs/pkgs must not reach apps/
    // (covered by libs-not-apps / pkgs-not-apps, which match apps/product/).
    // Path-based tier rules catch the relative `../../libs/...` escape hatch.
    // Workspace @scope imports are not reliably traversed by depcruise (bun symlinks).
    {
      name: 'pkgs-not-libs',
      severity: 'error',
      comment:
        'pkgs/ must not import libs/ (tier boundary). pkgs is the leaf tier: reusable, app-agnostic. Move the importer to libs/, or invert the dependency.',
      from: { path: '^pkgs/' },
      to: { path: '^libs/' },
    },
    {
      name: 'pkgs-not-apps',
      severity: 'error',
      comment:
        'pkgs/ must not import apps/ (tier boundary). pkgs cannot depend on a specific product surface.',
      from: { path: '^pkgs/' },
      to: { path: '^apps/' },
    },
    {
      name: 'libs-not-apps',
      severity: 'error',
      comment:
        'libs/ must not import apps/ (tier boundary). Apps compose libs; not the reverse.',
      from: { path: '^libs/' },
      to: { path: '^apps/' },
    },
    // Feature packages are bounded contexts: they know their own slice and the
    // platform, never the app that composes them. `@libs/runtime` is the
    // composition root's fold; a feature reaching for it inverts the whole
    // arrangement and would pull every other feature into its build.
    {
      name: 'feature-no-composition-root',
      severity: 'error',
      comment:
        'A feature package (and the app shell) must not import the composition root (@libs/runtime / libs/runtime). Declare what it needs as a port on its manifest and let the composition root fill it.',
      from: {
        path: '^libs/(auth|billing|chess|client-app|client-config|feature|friends|notifications|permissions|profile|search|spaces|user-search)/src/',
      },
      to: { path: '^libs/runtime/' },
    },
    // The shell is what a feature's own e2e boots. The moment it imports a
    // feature, every feature is in every feature's build graph and per-feature
    // test caching is gone — so this rule is load-bearing for the whole
    // arrangement, not housekeeping.
    {
      name: 'shell-no-features',
      severity: 'error',
      comment:
        'The app shell (@libs/client-app) must not import a feature. Routes, tabs, docks and providers arrive through the FeatureClient fold; anything else the shell needs is a port the composition root fills. Platform packages (auth, permissions, client-config, feature, test-ids) are fine.',
      from: { path: '^libs/client-app/src/' },
      to: {
        path: '^libs/(billing|chess|friends|games|notifications|profile|search|spaces|user-search)/',
      },
    },
    {
      name: 'shared-no-wall-io-packages',
      severity: 'error',
      comment:
        'Shared game/domain logic must not import networking or wall Io construction. Inject Io ports from composition roots. See docs/DETERMINISM.md.',
      from: {
        path: '(^libs/[^/]+/src/shared/|^libs/[^/]+/src/use-cases/[^/]+/shared/|^pkgs/room/src/(client/core|server/core|types\\.ts|hash-room-state\\.ts))',
        pathNot: '(\\.test\\.|\\.spec\\.|/tests/|/e2e/)',
      },
      to: {
        path: '(^pkgs/http-client/|^pkgs/pubsub/|^pkgs/pubsub-emqx/|/wall-io\\.ts$|/src/wall\\.ts$)',
      },
    },
    {
      name: 'product-no-sim-deps',
      severity: 'error',
      comment:
        'Session / @pkgs/sim is harness-only. Product apps and non-test product libs must receive unpacked clock/timers/createId/random/http. DST package tests and @apps/product may import @pkgs/sim.',
      from: {
        path: '^(apps/|libs/)',
        pathNot:
          '(\\.test\\.|\\.spec\\.|/tests/|/e2e/|/src/sim/|^apps/product/)',
      },
      to: {
        path: '^pkgs/sim/',
      },
    },
    {
      name: 'sim-seam-harness-only',
      severity: 'error',
      comment:
        'Package src/sim/** is harness-only: import from src/sim/**, tests/**, or the package ./sim export (index). Product/runtime code must not deep-import sim internals. apps/product/src/sim/ is the shared product harness itself, not a package-local seam.',
      from: {
        pathNot: '(/src/sim/|/tests/|\\.test\\.|\\.spec\\.|/e2e/)',
      },
      to: {
        path: '/src/sim/',
        // Allow the public ./sim seam entry (…/src/sim/index.ts) and the
        // shared product harness (apps/product/src/sim/**).
        pathNot: '(/src/sim/index\\.ts$|^apps/product/src/sim/)',
      },
    },
    {
      name: 'sim-internals-harness-only',
      severity: 'error',
      comment:
        'Only pkgs/sim/** (runtime + internals + sim tests) may import @pkgs/sim/internals.',
      from: {
        pathNot: '^pkgs/sim/',
      },
      to: {
        path: '^pkgs/sim/src/internals/',
        pathNot: '(\\.test\\.|\\.spec\\.|/tests/)',
      },
    },
    {
      name: 'sim-core-no-fast-check',
      severity: 'error',
      comment:
        '@pkgs/sim core (except the fast-check adapter and tests) must not import fast-check.',
      from: {
        path: '^pkgs/sim/src/',
        pathNot: '^pkgs/sim/src/fast-check/|(\\.test\\.|\\.spec\\.|/tests/)',
      },
      to: {
        path: 'node_modules/fast-check/',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
    },
    // Skip generated build artifacts that bundlers/wranglers stage inside
    // a package directory. These are not source and produce false positives
    // (e.g. wrangler dev stages `.wrangler/` inside a package directory).
    exclude: '(^|/)(\\.wrangler|\\.turbo|dist|build|coverage)/',
    tsPreCompilationDeps: true,
    includeOnly: '^(apps|libs|pkgs)/',
  },
};
