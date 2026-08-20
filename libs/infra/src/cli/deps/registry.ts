import { BunDep } from './bun';
import { EasDep } from './eas';
import { PgDumpDep } from './pg-dump';
import { SecretBackendDep } from './secret-backend';
import { TurboDep } from './turbo';
import type { Dep } from './types';
import { WranglerDep } from './wrangler';

const wrangler = new WranglerDep();
const turbo = new TurboDep();
const bun = new BunDep();
const secretBackend = new SecretBackendDep();
const eas = new EasDep();
const pgDump = new PgDumpDep();

/**
 * Every CLI dep the toolchain knows about. Used by `setup` (installs
 * everything on a developer workstation) and `status` (reports the full
 * matrix). CI phase commands should NOT use this list directly — they
 * deliberately install only a subset and must check the matching subset via
 * `PROVISION_DEPS` / `DEPLOY_DEPS` so `runCheckDepsPhase` doesn't fail on
 * tools the runner never installed.
 */
export const ALL_DEPS: readonly Dep[] = [
  wrangler,
  turbo,
  bun,
  secretBackend,
  eas,
  pgDump,
];

/**
 * Deps required by the CI `provision` phase: Wrangler talks to the
 * Cloudflare API, and Bun + secret store power the CLI runtime + secrets.
 */
export const PROVISION_DEPS: readonly Dep[] = [wrangler, bun, secretBackend];

/**
 * Deps required by the legacy single-process `deploy` lifecycle: the
 * provision set plus the EAS CLI (for the `publish-client-eas-update` phase —
 * OTA `eas update`; the manual `build-client-native` command reuses the same
 * dep).
 *
 * Billing catalog sync (`runBillingSyncPhase`) uses the vendor adapter via
 * Bun and does not require a native vendor CLI.
 */
export const DEPLOY_DEPS: readonly Dep[] = [wrangler, bun, secretBackend, eas];
