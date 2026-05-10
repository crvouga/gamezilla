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
          '(\\.(test|spec)\\.|/(__tests__|testkit|fixtures?|tests?)/|packages/room/src/(simulator|testkit)\\.ts)',
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
    // packages/client cannot reach server code in any feature.
    {
      name: 'apps-client-no-server',
      severity: 'error',
      from: { path: '^packages/client/' },
      to: { path: '/src/server/' },
    },
    // packages/api cannot reach client code in any feature.
    {
      name: 'apps-api-no-client',
      severity: 'error',
      from: { path: '^packages/api/' },
      to: { path: '/src/client/' },
    },
    {
      name: 'no-non-package-json',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'not-to-dev-dep-from-src',
      severity: 'error',
      from: {
        path: '^packages/[^/]+/src/',
        pathNot: '\\.(test|spec|example)\\.',
      },
      to: { dependencyTypes: ['npm-dev'] },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
    },
    tsPreCompilationDeps: true,
    includeOnly: '^packages/',
  },
};
