'use strict';

/**
 * Solid-only scope (grows per port phase). Files here must not import React,
 * React Native, Expo, or the legacy `@pkgs/ui-rn` design system.
 */
const solidScope = require('./tools/port/solid-scope.json');
/**
 * Framework-agnostic core (grows per port phase). Files here must not import
 * any UI framework — neither React/RN/Expo nor solid-js.
 */
const coreScope = require('./tools/port/core-scope.json');

const scopeToPathRegex = (scope) =>
  `^(${[...scope.dirs.map((dir) => `${dir}/`), ...scope.files]
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})`;
const solidScopePath = scopeToPathRegex(solidScope);
const coreScopePath = scopeToPathRegex(coreScope);

const REACT_STACK_PATH =
  'node_modules/(react|react-dom|react-native|react-native-[^/]+|expo|expo-[^/]+|@expo|@react-navigation|@react-native|@shopify/react-native-skia|@gorhom|@legendapp|lucide-react|lucide-react-native|@lingui/react)/';
const SOLID_STACK_PATH =
  'node_modules/(solid-js|@solidjs/[^/]+|@lingui/solid|lucide-solid|@tanstack/solid-[^/]+)/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'solid-no-react-native',
      severity: 'error',
      comment:
        'Solid code must not import React / React Native / Expo / @pkgs/ui-rn. See tools/port/solid-scope.json.',
      from: { path: solidScopePath },
      to: { path: `(${REACT_STACK_PATH}|^pkgs/ui-rn/)` },
    },
    {
      name: 'core-no-framework',
      severity: 'error',
      comment:
        'Framework-agnostic core must not import React / RN / Expo or solid-js. See tools/port/core-scope.json.',
      from: { path: coreScopePath },
      to: { path: `(${REACT_STACK_PATH}|${SOLID_STACK_PATH}|^pkgs/ui-rn/)` },
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
    // (pkgs triad src/shared and product-lib use-cases/*/shared + src/shared).
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
      to: { path: '^pkgs/assistant/src/(shared|client)/_internal/' },
    },
    {
      name: 'not-to-dev-dep-from-src',
      severity: 'error',
      from: {
        path: '^(apps|libs|pkgs|product)/[^/]+/src/',
        pathNot: '(\\.test\\.|\\.spec\\.|/tests/|/e2e/)',
      },
      to: { dependencyTypes: ['npm-dev'] },
    },
    // Tier import pyramid: product -> apps, libs, pkgs; apps -> libs, pkgs; libs -> pkgs; pkgs -> pkgs.
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
      name: 'pkgs-not-product',
      severity: 'error',
      comment:
        'pkgs/ must not import product/ (tier boundary). Product is the composition hub above apps.',
      from: { path: '^pkgs/' },
      to: { path: '^product/' },
    },
    {
      name: 'libs-not-apps',
      severity: 'error',
      comment:
        'libs/ must not import apps/ (tier boundary). Apps compose libs; not the reverse.',
      from: { path: '^libs/' },
      to: { path: '^apps/' },
    },
    {
      name: 'libs-not-product',
      severity: 'error',
      comment:
        'libs/ must not import product/ (tier boundary). Product composes libs; not the reverse.',
      from: { path: '^libs/' },
      to: { path: '^product/' },
    },
    {
      name: 'apps-not-product',
      severity: 'error',
      comment:
        'apps/ must not import product/ (tier boundary). Product composes apps; apps must not depend on the composition hub.',
      from: { path: '^apps/' },
      to: { path: '^product/' },
    },
    {
      name: 'shared-no-wall-io-packages',
      severity: 'error',
      comment:
        'Shared game/domain logic must not import networking or wall Io construction. Inject Io ports from composition roots. See DETERMINISM.md.',
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
        'Session / @pkgs/sim is harness-only. Product apps and non-test product libs must receive unpacked clock/timers/createId/random/http. DST package tests and @product/* may import @pkgs/sim.',
      from: {
        path: '^(apps/|libs/)',
        pathNot: '(\\.test\\.|\\.spec\\.|/tests/|/e2e/|/src/sim/)',
      },
      to: {
        path: '^pkgs/sim/',
      },
    },
    {
      name: 'sim-seam-harness-only',
      severity: 'error',
      comment:
        'Package src/sim/** is harness-only: import from src/sim/**, tests/**, or the package ./sim export (index). Product/runtime code must not deep-import sim internals.',
      from: {
        pathNot: '(/src/sim/|/tests/|\\.test\\.|\\.spec\\.|/e2e/)',
      },
      to: {
        path: '/src/sim/',
        // Allow the public ./sim seam entry (…/src/sim/index.ts).
        pathNot: '/src/sim/index\\.ts$',
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
    exclude: '(^|/)(\\.wrangler|\\.turbo|\\.expo|dist|build|coverage)/',
    tsPreCompilationDeps: true,
    includeOnly: '^(apps|libs|pkgs|product)/',
  },
};
