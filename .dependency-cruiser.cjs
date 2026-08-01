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
    // The authoritative gate is tooling/scripts/check-tier-imports.ts (workspace
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
      name: 'rules-no-cross-context',
      severity: 'error',
      comment:
        '@pkgs/rules domain modules must not import sibling domains. Share only via core/.',
      from: { path: '^pkgs/rules/src/auth/' },
      to: { path: '^pkgs/rules/src/(chess|friends|profile|spaces)/' },
    },
    {
      name: 'rules-no-cross-context-chess',
      severity: 'error',
      comment:
        '@pkgs/rules domain modules must not import sibling domains. Share only via core/.',
      from: { path: '^pkgs/rules/src/chess/' },
      to: { path: '^pkgs/rules/src/(auth|friends|profile|spaces)/' },
    },
    {
      name: 'rules-no-cross-context-friends',
      severity: 'error',
      comment:
        '@pkgs/rules domain modules must not import sibling domains. Share only via core/.',
      from: { path: '^pkgs/rules/src/friends/' },
      to: { path: '^pkgs/rules/src/(auth|chess|profile|spaces)/' },
    },
    {
      name: 'rules-no-cross-context-profile',
      severity: 'error',
      comment:
        '@pkgs/rules domain modules must not import sibling domains. Share only via core/.',
      from: { path: '^pkgs/rules/src/profile/' },
      to: { path: '^pkgs/rules/src/(auth|chess|friends|spaces)/' },
    },
    {
      name: 'rules-no-cross-context-spaces',
      severity: 'error',
      comment:
        '@pkgs/rules domain modules must not import sibling domains. Share only via core/.',
      from: { path: '^pkgs/rules/src/spaces/' },
      to: { path: '^pkgs/rules/src/(auth|chess|friends|profile)/' },
    },
    {
      name: 'libs-not-apps',
      severity: 'error',
      comment:
        'libs/ must not import apps/ (tier boundary). Apps compose libs; not the reverse.',
      from: { path: '^libs/' },
      to: { path: '^apps/' },
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
    includeOnly: '^(apps|libs|pkgs)/',
  },
};
