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
 * The import-boundary Grit rules (`libs/tools-harness-ts/biome-plugins/import-*.grit`)
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
    path: 'libs/game-session-shared-ts/src/concrete.ts',
    source: "import { rules } from '@libs/chess-rules-shared-ts/chess-rules';",
    message:
      'Shared game components receive rules and presentation through ports',
  },
  {
    path: 'libs/game-session-client-ts/src/concrete.ts',
    source: "export { Board } from '@libs/connect-four-client-ts/board';",
    message:
      'Shared game components receive rules and presentation through ports',
  },
  {
    path: 'libs/game-matchmaking-shared-ts/src/concrete.ts',
    source: "const game = import('chess.js');",
    message:
      'Shared game components receive rules and presentation through ports',
  },
  {
    path: 'pkgs/turn-game-client-ts/src/concrete.ts',
    source: "const rules = require('@libs/game-catalog-shared-ts/turn-games');",
    message:
      'Shared game components receive rules and presentation through ports',
  },
  {
    path: 'libs/synthetic-population-shared-ts/src/concrete.ts',
    source: "import { Chess } from 'chess.js';",
    message:
      'Shared game components receive rules and presentation through ports',
  },
  {
    path: 'libs/game-session-harness-ts/src/concrete.ts',
    source:
      "import { probe } from '@libs/chess-root-harness-ts/chess-custom-game-board';",
    message:
      'Shared game components receive rules and presentation through ports',
  },
  {
    path: 'libs/game-matchmaking-harness-ts/src/concrete.ts',
    source:
      "import { TURN_GAMES } from '@libs/game-catalog-shared-ts/turn-games';",
    message:
      'Shared game components receive rules and presentation through ports',
  },
  {
    path: 'libs/synthetic-population-shared-ts/src/port.ts',
    source:
      "import type { GameAutomation } from '@pkgs/turn-game-shared-ts/game-automation';",
    message: null,
  },
  {
    path: 'libs/game-session-client-ts/src/port.ts',
    source:
      "import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';",
    message: null,
  },
  {
    path: 'libs/chess-root-harness-ts/tests/concrete.test.ts',
    source: "import { rules } from '@libs/chess-rules-shared-ts/chess-rules';",
    message: null,
  },
  {
    path: 'libs/zz/src/provision-bucket.ts',
    source:
      'await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}/r2/buckets`, { method: "POST" });',
    message: "Infrastructure is OpenTofu's",
  },
  {
    path: 'libs/zz/src/provision-railway.ts',
    source: "const url = 'https://backboard.railway.com/graphql/v2';",
    message: "Infrastructure is OpenTofu's",
  },
  {
    path: 'libs/zz/src/verify-token.ts',
    source:
      "const url = 'https://api.cloudflare.com/client/v4/user/tokens/verify';",
    message: null,
  },
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
    path: 'libs/zz/src/stamp-user.ts',
    source: 'span.setAttribute(ATTR.USER_ID, id);',
    message: 'Bind identity with bindIdentity()',
  },
  {
    path: 'libs/zz/src/stamp-device.ts',
    source: 'activeSpan()?.setAttribute(ATTR.APP_DEVICE_ID, id);',
    message: 'Bind identity with bindIdentity()',
  },
  {
    path: 'libs/zz/src/bind-user.ts',
    source: 'bindIdentity({ userId: id });',
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
    // regression: flattened-observability-boundary
    path: 'pkgs/observability-root-shared-ts/src/sdk.ts',
    source:
      "import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';",
    message: 'core and query are runtime-agnostic',
  },
  {
    path: 'pkgs/observability-root-shared-ts/src/api.ts',
    source: "import { trace } from '@opentelemetry/api';",
    message: null,
  },
  {
    path: 'libs/app-root-server-ts/src/request-telemetry.ts',
    source:
      "import { withSpan } from '@pkgs/observability-root-shared-ts/span';",
    message: null,
  },
  {
    path: 'libs/zz-client-ts/src/observability-feature.ts',
    source:
      "import { withSpan } from '@pkgs/observability-root-shared-ts/span';",
    message: 'confined to the ADR boundary-file inventory',
  },
  {
    path: 'libs/zz-client-ts/src/reproducible-error.ts',
    source:
      "import { ReproducibleError } from '@pkgs/observability-root-shared-ts/reproducible-error';",
    message: null,
  },
  {
    path: 'libs/game-session-shared-ts/src/simulation-failure.ts',
    source:
      "import { recordException } from '@pkgs/observability-root-shared-ts/span';",
    message: 'confined to the ADR boundary-file inventory',
  },
  {
    path: 'apps/client-ts/src/main.tsx',
    source:
      "import { createNodeTelemetry } from '@pkgs/observability-root-server-ts/node-node';",
    message: 'Node observability runtime is restricted',
  },
  {
    path: 'apps/server-ts/src/room.ts',
    source:
      "import { createBrowserTelemetry } from '@pkgs/observability-root-client-ts/browser';",
    message: 'browser observability runtime is restricted',
  },
  {
    path: 'libs/app-root-client-ts/src/browser-boundaries.ts',
    source:
      "import { createWorkerTelemetry } from '@pkgs/observability-root-server-ts/worker-worker';",
    message: 'Worker observability runtime is restricted',
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
    path: 'pkgs/equal-shared-ts/src/view.ts',
    source: "import { createSignal } from 'solid-js';",
    message: 'Framework-agnostic core must not import solid-js',
  },
  {
    path: 'pkgs/equal-client/src/solid.ts',
    source: "import { createSignal } from 'solid-js';",
    message: null,
  },
  {
    path: 'pkgs/equal-shared-ts/src/plain.ts',
    source: "import { x } from './x';",
    message: null,
  },
  {
    path: 'libs/zz/src/prod.ts',
    source: "import { h } from '../tests/helper';",
    message: 'Production code must not import test code',
  },
  {
    path: 'libs/zz/src/uses-fixtures.ts',
    source: "import { s } from './fixture-tests/run';",
    message: null,
  },
  {
    path: 'pkgs/zz-shared-ts/src/leaf.ts',
    source: "import { a } from '@libs/auth-shared-ts/x';",
    message: 'pkgs/ must not import libs/ or apps/',
  },
  {
    path: 'pkgs/zz/src/relative.ts',
    source: "import { a } from '../../../libs/auth/src/x';",
    message: 'pkgs/ must not import libs/ or apps/',
  },
  {
    path: 'libs/zz/src/app.ts',
    source: "import { a } from '@apps/client-ts/x';",
    message: 'libs/ must not import apps/',
  },
  {
    path: 'libs/zz-shared-ts/src/net.ts',
    source: "import { a } from '@pkgs/http-client-shared-ts/http-client';",
    message: 'Shared game/domain logic must not import networking',
  },
  {
    path: 'libs/zz-client-ts/src/harness-user.ts',
    source:
      "import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';",
    message: '@pkgs/harness-root-shared-ts is harness-only',
  },
  {
    path: 'libs/zz-client-ts/src/report-user.ts',
    source: "import { r } from '@pkgs/harness-console-client-ts/app';",
    message: null,
  },
  {
    path: 'libs/zz-server-ts/src/transport.ts',
    source: "import { e } from '@pkgs/pubsub-emqx-shared-ts/emqx-pubsub';",
    message: '@pkgs/pubsub-emqx-* only from',
  },
  {
    path: 'libs/pubsub-server-ts/src/wiring.ts',
    source: "import { e } from '@pkgs/pubsub-emqx-shared-ts/emqx-pubsub';",
    message: null,
  },
  {
    path: 'pkgs/harness-root-shared-ts/src/core.ts',
    source: "import fc from 'fast-check';",
    message:
      '@pkgs/harness-root-shared-ts core (except src/fast-check/ and tests)',
  },
  {
    path: 'libs/zz-server-ts/src/route.ts',
    source:
      "import { PaddleMembershipBilling } from '@pkgs/billing-paddle-shared-ts/paddle-membership';",
    message:
      'Product code knows billing only through the @pkgs/billing-root-shared-ts',
  },
  {
    path: 'libs/zz-client-ts/src/screen.tsx',
    source: "import Stripe from 'stripe';",
    message:
      'Product code knows billing only through the @pkgs/billing-root-shared-ts',
  },
  {
    path: 'pkgs/billing-root-shared-ts/src/port.ts',
    source:
      "export { STRIPE_PROVIDER } from '@pkgs/billing-stripe-server-ts/stripe-provider';",
    message:
      'Product code knows billing only through the @pkgs/billing-root-shared-ts',
  },
  {
    path: 'libs/zz-server-ts/src/port-route.ts',
    source:
      "import type { MembershipProviders } from '@pkgs/billing-root-shared-ts/membership';",
    message: null,
  },
  {
    path: 'libs/zz-harness-ts/src/provider-driver.ts',
    source:
      "import { createStripeClient } from '@pkgs/billing-stripe-server-ts/stripe-client';",
    message: null,
  },
  {
    path: 'apps/server-ts/src/product-server.ts',
    source:
      "import { createPaddleMembershipBillingFromSecretStore } from '@pkgs/billing-paddle-shared-ts/paddle-membership';",
    message: null,
  },
  {
    path: 'libs/zz-client-ts/src/gate.tsx',
    source:
      "import { useIsSignedIn } from '@libs/auth-client-ts/access-facts';",
    message: 'Only @libs/permissions reads sign-in state',
  },
  {
    path: 'libs/permissions-client-ts/src/facts.ts',
    source:
      "import { useIsSignedIn } from '@libs/auth-client-ts/access-facts';",
    message: null,
  },
  {
    path: 'libs/zz-client-ts/src/plan.ts',
    source: "import { ROLE } from '@libs/permissions-shared-ts/access-model';",
    message: 'Roles, plans and access facts are private to @libs/permissions',
  },
  {
    path: 'libs/zz-client-ts/tests/plan.test.ts',
    source: "import { ROLE } from '@libs/permissions-shared-ts/access-model';",
    message: null,
  },
  {
    path: 'libs/app-root-server-ts/src/create-server.ts',
    source:
      "import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared-ts/access-model';",
    message: null,
  },
  {
    path: 'libs/zz-shared-ts/src/act-mutation.ts',
    source: 'export const guest = (env: { isAnon: boolean }) => env.isAnon;',
    message: 'Sign-in state and membership are read only by auth, billing',
  },
  {
    path: 'libs/zz-client-ts/src/banner.tsx',
    source: 'export const show = (signedIn: boolean) => !signedIn;',
    message: 'Sign-in state and membership are read only by auth, billing',
  },
  {
    path: 'libs/zz-client-ts/src/member-query.ts',
    source:
      'export const q = `\n  SELECT status\n  FROM billing_subscriptions\n`;',
    message: 'Sign-in state and membership are read only by auth, billing',
  },
  {
    path: 'libs/auth-client-ts/src/session.ts',
    source: 'export const guest = (env: { isAnon: boolean }) => env.isAnon;',
    message: null,
  },
  {
    path: 'libs/zz-client-ts/src/actor.ts',
    source: 'export const who = (env: { actorId: string }) => env.actorId;',
    message: null,
  },
  {
    path: 'libs/zz-client-ts/src/sign-in.tsx',
    source:
      "import { createInhouseAuthClient } from '@pkgs/auth-inhouse-client-ts/create-inhouse-auth-client';",
    message: 'Product code knows auth only through the @pkgs/auth port',
  },
  {
    path: 'libs/zz-server-ts/src/me-route.ts',
    source: "import { clerkClient } from '@clerk/backend';",
    message: 'Product code knows auth only through the @pkgs/auth port',
  },
  {
    path: 'libs/zz-server-ts/src/admin.ts',
    source: "const admin = await import('firebase-admin/auth');",
    message: 'Product code knows auth only through the @pkgs/auth port',
  },
  {
    path: 'pkgs/auth-root-shared-ts/src/port.ts',
    source:
      "export { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-provider';",
    message: 'Product code knows auth only through the @pkgs/auth port',
  },
  {
    path: 'libs/zz-server-ts/src/me-port-route.ts',
    source:
      "import type { AuthServerPort } from '@pkgs/auth-root-shared-ts/auth-server-port';",
    message: null,
  },
  {
    path: 'libs/runtime-server-ts/src/app-auth-provider.ts',
    source:
      "import { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-provider';",
    message: null,
  },
  {
    path: 'libs/zz-harness-ts/src/idp-driver.ts',
    source:
      "import { IdpRepository } from '@pkgs/auth-inhouse-server-ts/idp-repository';",
    message: null,
  },
  {
    path: 'pkgs/zz/tests/unpinned.test.ts',
    source: 'fc.assert(fc.property(fc.nat(), (n) => n >= 0));',
    message: 'Run properties through assertProperty',
  },
  {
    path: 'pkgs/zz/tests/sampled.test.ts',
    source: 'const [x] = fc.sample(fc.nat(), 1);',
    message: 'Run properties through assertProperty',
  },
  {
    path: 'pkgs/zz/tests/pinned.test.ts',
    source: "assertProperty('n', fc.property(fc.nat(), (n) => n >= 0));",
    message: null,
  },
  {
    path: 'pkgs/property-shared-ts/src/zz.ts',
    source: 'fc.assert(property, params);',
    message: null,
  },
  {
    path: 'pkgs/zz/tests/aliased.test.ts',
    source: "import { assert as run } from 'fast-check';",
    message: 'importing fast-check',
  },
  {
    path: 'pkgs/zz/tests/arbitraries.test.ts',
    source: "import { type Arbitrary } from 'fast-check';",
    message: null,
  },
  {
    path: 'pkgs/zz/tests/skip.test.ts',
    source: "test.skip('x', () => {});",
    message: 'Skipped tests are banned',
  },
  {
    path: 'pkgs/zz/tests/todo.test.ts',
    source: "it.todo('x');",
    message: 'Skipped tests are banned',
  },
  {
    path: 'pkgs/zz/tests/conditional.test.ts',
    source: "describe.if(ok)('x', () => {});",
    message: 'Skipped tests are banned',
  },
  {
    path: 'pkgs/zz/tests/only.test.ts',
    source: "test.only('x', () => {});",
    message: 'Focused tests are banned',
  },
  {
    path: 'pkgs/zz/tests/failing.test.ts',
    source: "test.failing('x', () => {});",
    message: 'Expected-failure tests are banned',
  },
  {
    path: 'pkgs/zz/tests/plain.test.ts',
    source: "test('x', () => {});",
    message: null,
  },
  {
    path: 'pkgs/zz/tests/sleep.test.ts',
    source: 'await new Promise((r) => setTimeout(r, 30));',
    message: 'Tests run on virtual time',
  },
  {
    path: 'libs/zz/src/monotonic-default.ts',
    source: 'const clock = monotonicClock;',
    message: 'monotonicClock only in tests',
  },
  {
    path: 'pkgs/zz-server-ts/src/wall-reports-env.ts',
    source: 'const clock = monotonicClock;',
    message: null,
  },
  {
    path: 'pkgs/zz/tests/wall.test.ts',
    source: 'const clock = wallClock;',
    message: 'Tests run on virtual time',
  },
  {
    path: 'pkgs/zz/tests/now.test.ts',
    source: 'const at = new Date();',
    message: 'Tests run on virtual time',
  },
  {
    path: 'pkgs/zz/tests/virtual.test.ts',
    source: 'harness.timers.setTimeout(done, 30);',
    message: null,
  },
  {
    path: 'pkgs/zz/tests/broker.contract.test.ts',
    source: 'const clock = wallClock;',
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
  // One Biome run over the probes; a loaded verification run can take seconds.
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
