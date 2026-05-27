'use strict';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
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
        pathNot:
          '(\\.(test|spec)\\.|/(__tests__|testkit|fixtures?|tests?)/|(apps|libs|pkgs)/[^/]+/src/(simulator|testkit)\\.ts)',
      },
      to: {
        path: '(\\.(test|spec)\\.|/(__tests__|testkit|fixtures?|tests?)/)',
        pathNot: 'smoke-tests',
      },
    },
    // Shared cannot reach into any runtime-specific code, anywhere in the repo.
    {
      name: 'shared-pure',
      severity: 'error',
      from: { path: '/src/shared/' },
      to: { path: '/src/(client|server)/' },
    },
    // Within and across feature packages, client and server are isolated.
    {
      name: 'client-not-server',
      severity: 'error',
      from: { path: '/src/client/' },
      to: { path: '/src/server/' },
    },
    {
      name: 'server-not-client',
      severity: 'error',
      from: { path: '/src/server/' },
      to: { path: '/src/client/' },
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
        path: '^(apps|libs|pkgs)/[^/]+/src/',
        pathNot: '\\.(test|spec|example)\\.',
      },
      to: { dependencyTypes: ['npm-dev'] },
    },
    // Tier import pyramid: apps -> libs, pkgs; libs -> pkgs; pkgs -> pkgs.
    // The authoritative gate is scripts/check-tier-imports.ts (workspace
    // @scope imports through bun symlinks aren't reliably traversed here).
    // These path-based rules catch the relative `../../libs/...` escape hatch.
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
    // ──────────────────────────────────────────────────────────────────────
    // `@pkgs/ui` ports-and-adapters boundary
    //
    // The port (`@pkgs/ui` public API) is the only surface consumers see.
    // Adapter internals (`pkgs/ui/src/adapters/**`) are private; HeroUI Native
    // and its peers stay confined to the HeroUI adapter folder so swapping
    // adapters never leaks implementation details.
    // ──────────────────────────────────────────────────────────────────────
    {
      name: 'ui-adapter-internals-private',
      severity: 'error',
      comment:
        '@pkgs/ui adapter internals are private. The boot-time switch in pkgs/ui/src/adapter-registry.ts is the only legitimate importer; everything else must go through the @pkgs/ui public surface.',
      from: {
        pathNot:
          '^pkgs/ui/src/(adapters/|adapter-registry\\.ts$)',
      },
      to: { path: '^pkgs/ui/src/adapters/' },
    },
    {
      name: 'heroui-confined-to-adapter',
      severity: 'error',
      comment:
        'heroui-native and its companion deps (uniwind, tailwind-merge, tailwind-variants) may only be imported from pkgs/ui/src/adapters/heroui/**. Everything else must go through the @pkgs/ui port surface. (ESLint no-restricted-imports in pkgs/ui/eslint.config.js is the primary enforcer; depcruise is defence-in-depth and only fires when the dep is part of the cruised graph.)',
      from: { pathNot: '^pkgs/ui/src/adapters/heroui/' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-no-pkg', 'npm-unknown'],
        path: '^(heroui-native|uniwind|tailwind-merge|tailwind-variants)(/|$)',
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
    // (e.g. wrangler dev bundles `apps/turbo-cache` into `pkgs/turbo-cache/.wrangler/`).
    exclude: '(^|/)(\\.wrangler|\\.turbo|\\.expo|dist|build|coverage)/',
    tsPreCompilationDeps: true,
    includeOnly: '^(apps|libs|pkgs)/',
  },
};
