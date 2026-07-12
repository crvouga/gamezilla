import { PROJECT_CONFIG } from '../../project-config';
import { ALL_DEPS } from '../deps/registry';
import { collectDepVersionIssues } from '../deps/version-check';
import { buildDistributedLock } from '../lib/build-distributed-lock';
import { banner, fail, fmtMs, heading, kv, ok, warn } from '../lib/fmt';
import { httpProbe } from '../lib/http-probe';
import { infraOutputs, type InfraOutputs } from '../lib/infra-outputs';
import type { CiPlatform } from '../platform/platform';
import { pingDatabase } from '../resources/postgres';
import { cfAccountId } from '../secrets/cloudflare';
import { loadSecretsIntoEnv } from '../secrets/secrets';
import { runCaptureAsync } from '../subprocess';
import type { Command } from './types';

export class StatusCommand implements Command {
  readonly id = 'status';
  readonly group = 'setup' as const;
  readonly summary = 'Health: deps, secrets, CF, DB, lock, URLs';

  constructor(_platform: CiPlatform) {}

  async execute(): Promise<void> {
    banner('Infrastructure Status');

    let failed = false;

    // ── 1. Dependencies ─────────────────────────────────────────────────
    heading('Dependencies');
    const depFailures: string[] = [];
    for (const dep of ALL_DEPS) {
      const r = await collectDepVersionIssues(dep);
      if (r.ok === true) {
        ok(dep.name, r.version);
        continue;
      }
      if (r.ok === 'unknown-latest') {
        warn(
          r.name,
          `${r.version} — could not resolve latest (offline or network)`
        );
        continue;
      }
      if (r.issue.kind === 'missing') {
        fail(r.issue.name, r.issue.reason);
        depFailures.push(r.issue.name);
        failed = true;
        continue;
      }
      fail(
        r.issue.name,
        `outdated ${r.issue.current} — latest is ${r.issue.latest}`
      );
      depFailures.push(r.issue.name);
      failed = true;
    }
    if (depFailures.length > 0) {
      warn(
        'Dependency issues',
        `${depFailures.join(', ')} — run \`bun run infra setup\` to install or upgrade`
      );
    }

    // ── 2. Secrets ────────────────────────────────────────────
    heading('Secrets');
    const secretResults = loadSecretsIntoEnv();
    const missingSecrets: string[] = [];
    for (const s of secretResults) {
      if (s.set) {
        ok(s.env);
      } else {
        fail(s.env, 'not found in the secret store');
        missingSecrets.push(s.env);
        failed = true;
      }
    }
    if (missingSecrets.length > 0) {
      warn(
        'Secret issues',
        `${missingSecrets.join(', ')} — run \`bun run infra setup\` to configure`
      );
    }

    // ── 3. Cloudflare auth ──────────────────────────────────────────────
    heading('Cloudflare');
    try {
      const whoami = await runCaptureAsync('wrangler', ['whoami'], {
        env: {
          ...process.env,
          CLOUDFLARE_ACCOUNT_ID: cfAccountId(),
        },
      });
      const identity = parseWranglerIdentity(whoami);
      ok('wrangler whoami', identity);
    } catch (e) {
      fail(
        'wrangler whoami',
        e instanceof Error ? e.message.split('\n')[0] : String(e)
      );
      failed = true;
    }

    // ── 4. Database (Neon Postgres) ───────────────────────────────────
    heading('Database');
    const db = await pingDatabase();
    if (db.ok) {
      const detail = db.host
        ? `SELECT 1 @ ${db.host} — ${fmtMs(db.durationMs)}`
        : `SELECT 1 — ${fmtMs(db.durationMs)}`;
      ok('Neon (postgres)', detail);
    } else {
      fail(
        'Neon (postgres)',
        `${db.error ?? 'unreachable'} (${fmtMs(db.durationMs)})`
      );
      failed = true;
    }

    // ── 5. Global lock ──────────────────────────────────────────────────
    heading('Global lock');
    try {
      const { lock, disconnect } = await buildDistributedLock();
      try {
        const s = await lock.status();
        if (s === null) {
          ok('Lock', 'unheld');
        } else {
          const started = Date.parse(s.startedAt);
          const age = Number.isFinite(started)
            ? fmtMs(Date.now() - started)
            : 'unknown';
          kv('holder', s.holder);
          kv('operation', s.operation);
          kv('started', `${age} ago`);
          kv('pid', String(s.pid));
          kv('ci', String(s.ci));
        }
      } finally {
        await disconnect();
      }
    } catch (e) {
      fail('Global lock', e instanceof Error ? e.message : String(e));
      failed = true;
    }

    // ── 6. Infra Outputs ────────────────────────────────────────────────
    heading('Infra Outputs');
    const outputs: InfraOutputs = infraOutputs({});
    for (const [k, v] of Object.entries(outputs)) {
      if (v) kv(k, v);
    }

    // ── 7. Endpoints ────────────────────────────────────────────────────
    heading('Endpoints');
    const { domain } = PROJECT_CONFIG;
    const urls = [
      `https://www.${domain}`,
      `https://api.${domain}/api/health`,
    ];

    for (const url of urls) {
      const result = await httpProbe(url, 10_000);
      if (result.status === 0) {
        fail(url, result.error ?? 'unreachable');
        failed = true;
      } else if (result.ok) {
        ok(url, `HTTP ${result.status} — ${fmtMs(result.durationMs)}`);
      } else {
        fail(url, `HTTP ${result.status}`);
        failed = true;
      }
    }

    if (failed) process.exit(1);
  }
}

/**
 * Extracts a short identity string from `wrangler whoami` output. Wrangler
 * prints a banner plus either an email, account table, or token scope list.
 * Fall back to a generic "authenticated" label if no email is present.
 */
function parseWranglerIdentity(whoami: string): string {
  const emailMatch = whoami.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (emailMatch) return emailMatch[0];
  if (/associated with the email/i.test(whoami)) return 'authenticated';
  if (/You are logged in/i.test(whoami)) return 'authenticated';
  return 'authenticated';
}
