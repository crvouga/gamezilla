import { ALL_DEPS } from '../../deps/registry';
import type { Dep } from '../../deps/types';
import { collectDepVersionIssues } from '../../deps/version-check';
import { fail, ok, warn } from '../fmt';
import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';
import { runCaptureAsync } from '../../subprocess';

/**
 * Step 0: confirm every required CLI dependency is installed and
 * at-or-above the pinned latest version. Same gate the legacy
 * single-process `deploy` runs first, lifted out so per-phase CI
 * commands (`provision`, `deploy-resources`, ...) can re-use it.
 *
 * `deps` defaults to {@link ALL_DEPS} for backwards compatibility,
 * but CI phases pass a narrower set (e.g. {@link PROVISION_DEPS}) so
 * the check matches what the workflow actually installed — otherwise
 * we hard-fail on dev-only tools (`pgweb`) or phase-specific tools
 * (`stripe`) that the runner never pulled in.
 */
export async function runCheckDepsPhase(
  platform: CiPlatform,
  deps: readonly Dep[] = ALL_DEPS
): Promise<void> {
  await runStep(platform, 'Dependency versions', async () => {
    const problems: string[] = [];
    for (const dep of deps) {
      const r = await collectDepVersionIssues(dep);
      if (r.ok === true) {
        ok(dep.name, r.version);
        continue;
      }
      if (r.ok === 'unknown-latest') {
        warn(r.name, `${r.version} — could not resolve latest, continuing`);
        continue;
      }
      if (r.issue.kind === 'missing') {
        fail(r.issue.name, r.issue.reason);
        problems.push(r.issue.name);
        continue;
      }
      fail(
        r.issue.name,
        `outdated ${r.issue.current} — latest is ${r.issue.latest}`
      );
      problems.push(r.issue.name);
    }
    if (problems.length > 0) {
      throw new Error(
        `Update CLI dependencies (${problems.join(', ')}) — run \`bun run infra setup\``
      );
    }
  });
}

/**
 * Step 1: confirm Wrangler is authenticated against the active Cloudflare
 * account. Cheap fail-fast before any provisioning hits the CF API.
 */
export async function runWranglerAuthPhase(
  platform: CiPlatform
): Promise<void> {
  await runStep(platform, 'Wrangler auth', async () => {
    const whoami = await runCaptureAsync('wrangler', ['whoami']);
    platform.notice(`Wrangler identity: ${whoami}`);
  });
}
