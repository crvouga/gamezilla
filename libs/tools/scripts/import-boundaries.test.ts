import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

/**
 * The import-boundary Grit rules (`libs/tools/biome-plugins/import-*.grit`)
 * replaced dependency-cruiser, which had cruised 0 modules per package and so
 * enforced nothing for as long as it ran. A rule that silently stops matching
 * is the failure this pins: every rule gets a probe that must be reported and
 * one that must not, linted by the real root config at a path its `includes`
 * select.
 */
/**
 * Probes live outside the repo, under a copy of the root Biome config with
 * absolute plugin paths: inside the repo they would race this package's own
 * `lint` (turbo runs `test` and `lint` concurrently). The probe paths below
 * carry the path segments the plugins' `includes` select on.
 */
const PROBE_ROOT = mkdtempSync(join(tmpdir(), 'import-boundary-probe-'));

type BiomeConfig = {
  readonly plugins: readonly (string | { readonly path: string })[];
  readonly [key: string]: unknown;
};

function probeBiomeConfig(): BiomeConfig {
  const config = JSON.parse(
    readFileSync(join(REPO_ROOT, 'biome.json'), 'utf8')
  ) as BiomeConfig;
  const absolute = (path: string): string => join(REPO_ROOT, path);
  return {
    ...config,
    vcs: { enabled: false },
    files: { includes: ['**'] },
    plugins: config.plugins.map((plugin) =>
      typeof plugin === 'string'
        ? absolute(plugin)
        : { ...plugin, path: absolute(plugin.path) }
    ),
  };
}

type Probe = {
  readonly path: string;
  readonly source: string;
  readonly message: string | null;
};

const PROBES: readonly Probe[] = [
  {
    path: 'libs/zz/src/observability-raw.ts',
    source: "span.setAttribute('app.mutation.id', id);",
    message: 'raw observability attribute strings',
  },
  {
    path: 'libs/zz/src/observability-attr.ts',
    source: 'span.setAttribute(ATTR.APP_MUTATION_ID, id);',
    message: null,
  },
  {
    path: 'apps/zz/src/console.ts',
    source: "console.log('temporary debug');",
    message: 'structured observability instead of console.log',
  },
  {
    path: 'apps/zz/src/console-error.ts',
    source: "console.error('terminal error surface');",
    message: null,
  },
  {
    path: 'libs/zz/src/observability-deep.ts',
    source: "import { x } from '@pkgs/observability/core/src/span';",
    message: 'deep src imports are forbidden',
  },
  {
    path: 'pkgs/observability/src/core/sdk.ts',
    source:
      "import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';",
    message: 'core and query are runtime-agnostic',
  },
  {
    path: 'pkgs/observability/src/query/api.ts',
    source: "import { trace } from '@opentelemetry/api';",
    message: null,
  },
  {
    path: 'libs/client-app/src/shell/observability/browser-identity.ts',
    source: "import { withSpan } from '@pkgs/observability/core';",
    message: null,
  },
  {
    path: 'libs/zz/src/observability-feature.ts',
    source: "import { withSpan } from '@pkgs/observability/core';",
    message: 'confined to the ADR boundary-file inventory',
  },
  {
    path: 'apps/client/src/main.tsx',
    source: "import { createNodeTelemetry } from '@pkgs/observability/node';",
    message: 'Node observability runtime is restricted',
  },
  {
    path: 'apps/room-server/src/room.ts',
    source:
      "import { createBrowserTelemetry } from '@pkgs/observability/browser';",
    message: 'browser observability runtime is restricted',
  },
  {
    path: 'libs/client-app/src/shell/observability/browser-boundaries.ts',
    source:
      "import { createWorkerTelemetry } from '@pkgs/observability/worker';",
    message: 'Worker observability runtime is restricted',
  },
  {
    path: 'libs/zz/src/observability-legacy.ts',
    source:
      "import { createObservability } from '@pkgs/observability/port/create-observability';",
    message: 'deep src imports are forbidden',
  },
  {
    path: 'libs/zz/src/observability-legacy-package.ts',
    source:
      "import { createLocalFileObservability } from '@pkgs/observability-impl-local-file';",
    message: 'deep src imports are forbidden',
  },
  {
    path: 'libs/zz/src/bad-span.ts',
    source: "startSpan('request');",
    message: 'Span names must match domain.action',
  },
  {
    path: 'libs/zz/src/good-span.ts',
    source: "startSpan('request.handle');",
    message: null,
  },
  {
    path: 'libs/zz/src/using-io.ts',
    source:
      "async function run() { using span = startSpan('request.handle'); await http.fetch('/api'); }",
    message: 'using startSpan scope',
  },
  {
    path: 'libs/zz/src/with-span-io.ts',
    source:
      "async function run() { await withSpan('request.handle', () => http.fetch('/api')); }",
    message: null,
  },
  {
    path: 'pkgs/equal/src/view.ts',
    source: "import { createSignal } from 'solid-js';",
    message: 'Framework-agnostic core must not import solid-js',
  },
  {
    path: 'pkgs/equal/src/solid.ts',
    source: "import { createSignal } from 'solid-js';",
    message: null,
  },
  {
    path: 'pkgs/equal/src/plain.ts',
    source: "import { x } from './x';",
    message: null,
  },
  {
    path: 'libs/zz/src/prod.ts',
    source: "import { h } from '../tests/helper';",
    message: 'Production code must not import test code',
  },
  {
    path: 'libs/zz/src/uses-smoke.ts',
    source: "import { s } from './smoke-tests/run';",
    message: null,
  },
  {
    path: 'libs/zz/src/shared/leaf.ts',
    source: "import { a } from '@pkgs/sync-engine/client';",
    message: 'shared/ must not import client/ or server/ code',
  },
  {
    path: 'libs/zz/src/use-cases/do-it/shared/leaf.ts',
    source: "import { a } from '../server/handler';",
    message: 'shared/ must not import client/ or server/ code',
  },
  {
    path: 'libs/zz/src/shared/fine.ts',
    source: "import { a } from '@libs/server-app';",
    message: null,
  },
  {
    path: 'libs/zz/src/root/client/view.ts',
    source: "import { a } from '../server/handler';",
    message: 'client/ must not import server/ code',
  },
  {
    path: 'libs/zz/src/root/server/route.ts',
    source: "const m = await import('../client/view');",
    message: 'server/ must not import client/ code',
  },
  {
    path: 'libs/zz/src/outside.ts',
    source: "import { a } from '@pkgs/assistant/shared/internal/engine';",
    message: 'Only @pkgs/assistant/shared and @pkgs/assistant/client',
  },
  {
    path: 'pkgs/zz/src/leaf.ts',
    source: "import { a } from '@libs/auth/public/x';",
    message: 'pkgs/ must not import libs/ or apps/',
  },
  {
    path: 'pkgs/zz/src/relative.ts',
    source: "import { a } from '../../../libs/auth/src/x';",
    message: 'pkgs/ must not import libs/ or apps/',
  },
  {
    path: 'libs/zz/src/app.ts',
    source: "import { a } from '@apps/client/x';",
    message: 'libs/ must not import apps/',
  },
  {
    path: 'libs/zz/src/shared/net.ts',
    source: "import { a } from '@pkgs/http-client';",
    message: 'Shared game/domain logic must not import networking',
  },
  {
    path: 'libs/zz/src/root/sim-user.ts',
    source: "import { defineSystem } from '@pkgs/sim';",
    message: '@pkgs/sim is harness-only',
  },
  {
    path: 'libs/zz/src/root/report-user.ts',
    source: "import { r } from '@pkgs/sim-report';",
    message: null,
  },
  {
    path: 'libs/zz/src/root/deep.ts',
    source: "import { a } from '../sim/actions';",
    message: 'src/sim/** is harness-only',
  },
  {
    path: 'libs/zz/src/root/seam.ts',
    source: "import { a } from '../sim/index';",
    message: null,
  },
  {
    path: 'pkgs/zz/src/internals-user.ts',
    source: "import { a } from '@pkgs/sim/internals';",
    message: 'Only pkgs/sim/** may import @pkgs/sim/internals',
  },
  {
    path: 'libs/zz/src/root/transport.ts',
    source: "import { e } from '@pkgs/pubsub-emqx';",
    message: '@pkgs/pubsub-emqx only from pkgs/pubsub-emqx',
  },
  {
    path: 'libs/pubsub/src/root/server/wiring.ts',
    source: "import { e } from '@pkgs/pubsub-emqx';",
    message: null,
  },
  {
    path: 'pkgs/sim/src/core.ts',
    source: "import fc from 'fast-check';",
    message: '@pkgs/sim core (except src/fast-check/ and tests)',
  },
  {
    path: 'libs/zz/src/use-cases/pay/server/route.ts',
    source: "import { PaddleMembershipBilling } from '@pkgs/billing-paddle';",
    message: 'Product code knows billing only through the @pkgs/billing',
  },
  {
    path: 'libs/zz/src/root/client/screen.tsx',
    source: "import Stripe from 'stripe';",
    message: 'Product code knows billing only through the @pkgs/billing',
  },
  {
    path: 'pkgs/billing/src/port.ts',
    source: "export { STRIPE_PROVIDER } from '@pkgs/billing-stripe';",
    message: 'Product code knows billing only through the @pkgs/billing',
  },
  {
    path: 'libs/zz/src/use-cases/pay/server/port-route.ts',
    source: "import type { MembershipProviders } from '@pkgs/billing';",
    message: null,
  },
  {
    path: 'libs/zz/src/sim/provider-driver.ts',
    source: "import { MOCK_BILLING_PATHS } from '@pkgs/billing-mock';",
    message: null,
  },
  {
    path: 'apps/server/src/server.ts',
    source:
      "import { createPaddleMembershipBillingFromSecretStore } from '@pkgs/billing-paddle';",
    message: null,
  },
  {
    path: 'libs/zz/src/root/client/gate.tsx',
    source: "import { useIsSignedIn } from '@libs/auth/public/access-facts';",
    message: 'Only @libs/permissions reads sign-in state',
  },
  {
    path: 'libs/permissions/src/use-cases/decide/client/facts.ts',
    source: "import { useIsSignedIn } from '@libs/auth/public/access-facts';",
    message: null,
  },
  {
    path: 'libs/zz/src/root/client/plan.ts',
    source: "import { ROLE } from '@libs/permissions/root/access-model';",
    message: 'Roles, plans and access facts are private to @libs/permissions',
  },
  {
    path: 'libs/zz/tests/plan.test.ts',
    source: "import { ROLE } from '@libs/permissions/root/access-model';",
    message: null,
  },
  {
    path: 'libs/server-app/src/app/create-server.ts',
    source:
      "import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions/root/access-model';",
    message: null,
  },
  {
    path: 'libs/zz/src/use-cases/act/shared/act-mutation.ts',
    source: 'export const guest = (env: { isAnon: boolean }) => env.isAnon;',
    message: 'Sign-in state and membership are read only by auth, billing',
  },
  {
    path: 'libs/zz/src/root/client/banner.tsx',
    source: 'export const show = (signedIn: boolean) => !signedIn;',
    message: 'Sign-in state and membership are read only by auth, billing',
  },
  {
    path: 'libs/zz/src/root/client/member-query.ts',
    source:
      'export const q = `\n  SELECT status\n  FROM billing_subscriptions\n`;',
    message: 'Sign-in state and membership are read only by auth, billing',
  },
  {
    path: 'libs/auth/src/root/client/session.ts',
    source: 'export const guest = (env: { isAnon: boolean }) => env.isAnon;',
    message: null,
  },
  {
    path: 'libs/zz/src/root/client/actor.ts',
    source: 'export const who = (env: { actorId: string }) => env.actorId;',
    message: null,
  },
  {
    path: 'libs/zz/src/root/client/sign-in.tsx',
    source:
      "import { createInhouseAuthClient } from '@pkgs/auth-inhouse/client';",
    message: 'Product code knows auth only through the @pkgs/auth port',
  },
  {
    path: 'libs/zz/src/use-cases/me/server/route.ts',
    source: "import { clerkClient } from '@clerk/backend';",
    message: 'Product code knows auth only through the @pkgs/auth port',
  },
  {
    path: 'libs/zz/src/root/server/admin.ts',
    source: "const admin = await import('firebase-admin/auth');",
    message: 'Product code knows auth only through the @pkgs/auth port',
  },
  {
    path: 'pkgs/auth/src/server/port.ts',
    source:
      "export { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse/server';",
    message: 'Product code knows auth only through the @pkgs/auth port',
  },
  {
    path: 'libs/zz/src/use-cases/me/server/port-route.ts',
    source: "import type { AuthServerPort } from '@pkgs/auth/server';",
    message: null,
  },
  {
    path: 'libs/runtime/src/root/server/app-auth-provider.ts',
    source:
      "import { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse/server';",
    message: null,
  },
  {
    path: 'libs/zz/src/sim/idp-driver.ts',
    source: "import { IdpRepository } from '@pkgs/auth-inhouse/server';",
    message: null,
  },
];

type Diagnostic = {
  readonly category: string;
  readonly message: string;
  readonly location: { readonly path: string };
};

let diagnostics: readonly Diagnostic[] = [];

beforeAll(() => {
  writeFileSync(
    join(PROBE_ROOT, 'biome.json'),
    JSON.stringify(probeBiomeConfig())
  );
  for (const probe of PROBES) {
    const file = join(PROBE_ROOT, probe.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${probe.source}\n`);
  }
  // The repo's Biome, not whatever `bunx` resolves outside the repo.
  const result = spawnSync(
    join(REPO_ROOT, 'node_modules/.bin/biome'),
    ['lint', '--reporter=json', '--max-diagnostics=none', '.'],
    { cwd: PROBE_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const report = JSON.parse(result.stdout) as {
    readonly diagnostics: readonly Diagnostic[];
  };
  diagnostics = report.diagnostics.filter((d) => d.category === 'plugin');
  // One Biome run over the probes; a loaded check run can take seconds.
}, 60_000);

afterAll(() => {
  rmSync(PROBE_ROOT, { recursive: true, force: true });
});

describe('import-boundary Grit rules', () => {
  for (const probe of PROBES) {
    const verdict = probe.message === null ? 'allows' : 'reports';
    test(`${verdict} ${probe.path}: ${probe.source}`, () => {
      const hits = diagnostics.filter((d) =>
        d.location.path.endsWith(probe.path)
      );
      if (probe.message === null) {
        expect(hits.map((d) => d.message)).toEqual([]);
        return;
      }
      expect(hits.map((d) => d.message).join('\n')).toContain(probe.message);
    });
  }
});
