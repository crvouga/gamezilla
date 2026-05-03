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
        pathNot: '(test|fixture|__tests__|testkit|libs/room/src/simulator/)',
      },
      to: {
        path: '(test|fixture|__tests__|testkit)',
        pathNot: 'smoke-tests',
      },
    },
    {
      name: 'domain-no-infra',
      severity: 'error',
      from: { path: '^libs/domain/' },
      to: {
        path: '^(apps/(api|db|infra|client)|libs/(patch-db|room|stripe))/',
      },
    },
    {
      name: 'lib-no-domain',
      severity: 'error',
      from: { path: '^libs/lib/' },
      to: { path: '^libs/domain/' },
    },
    {
      name: 'client-no-server-only',
      severity: 'error',
      from: { path: '^apps/client/' },
      to: {
        path: '^(apps/(api|db|infra|turbo-cache|stripe-cli)|libs/lib/src/(static-file-server|secret-store|distributed-lock|doppler|postgres))/',
      },
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
        path: '^(apps|libs)/[^/]+/src/',
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
    includeOnly: '^(apps|libs)/',
  },
};
