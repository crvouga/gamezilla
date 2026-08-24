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
      from: { path: '/client/' },
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
        path: '^(apps|libs|pkgs|sim)/[^/]+/src/',
        pathNot: '\\.(test|spec|example)\\.',
      },
      to: { dependencyTypes: ['npm-dev'] },
    },
    // Tier import pyramid: sim -> apps, libs, pkgs; apps -> libs, pkgs; libs -> pkgs; pkgs -> pkgs.
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
      name: 'pkgs-not-sim',
      severity: 'error',
      comment:
        'pkgs/ must not import sim/ (tier boundary). Sim is the composition hub above product.',
      from: { path: '^pkgs/' },
      to: { path: '^sim/' },
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
      name: 'libs-not-sim',
      severity: 'error',
      comment:
        'libs/ must not import sim/ (tier boundary). Sim composes libs; not the reverse.',
      from: { path: '^libs/' },
      to: { path: '^sim/' },
    },
    {
      name: 'apps-not-sim',
      severity: 'error',
      comment:
        'apps/ must not import sim/ (tier boundary). Sim composes apps; product must not depend on the harness.',
      from: { path: '^apps/' },
      to: { path: '^sim/' },
    },
    {
      name: 'shared-no-wall-io-packages',
      severity: 'error',
      comment:
        'Shared game/domain logic must not import networking or wall Io construction. Inject Io ports from composition roots. See DETERMINISM.md.',
      from: {
        path: '(^libs/[^/]+/src/shared/|^libs/[^/]+/src/use-cases/[^/]+/shared/|^pkgs/room/src/(client/core|server/core|types\\.ts|hash-room-state\\.ts))',
        pathNot:
          '(\\.(test|spec|sim\\.test)\\.|/(test|tests|testing|testkit|__tests__)/)',
      },
      to: {
        path: '(^pkgs/http-client/|^pkgs/pubsub/|^pkgs/pubsub-emqx/|/wall-io\\.ts$|/src/wall\\.ts$)',
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
    includeOnly: '^(apps|libs|pkgs|sim)/',
  },
};
