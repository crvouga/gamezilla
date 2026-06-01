import { BunDep } from './bun';
import { DopplerDep } from './doppler';
import { EasDep } from './eas';
import { PgwebDep } from './pgweb';
import { StripeDep } from './stripe';
import type { Dep } from './types';
import { TurboDep } from './turbo';
import { WranglerDep } from './wrangler';

const wrangler = new WranglerDep();
const turbo = new TurboDep();
const bun = new BunDep();
const doppler = new DopplerDep();
const stripe = new StripeDep();
const pgweb = new PgwebDep();
const eas = new EasDep();

/**
 * Every CLI dep the toolchain knows about. Used by `setup` (installs
 * everything on a developer workstation) and `status` (reports the full
 * matrix). CI phase commands should NOT use this list directly — they
 * deliberately install only a subset (e.g. `provision` skips `stripe`
 * + `pgweb`) and must check the matching subset via `PROVISION_DEPS`
 * / `DEPLOY_DEPS` so `runCheckDepsPhase` doesn't fail on tools the
 * runner never installed.
 *
 * The local PostgreSQL cluster (`@pkgs/postgres`) no longer needs a system
 * dep: its binaries ship via the `embedded-postgres` npm package and are
 * hydrated by `bun install`, so there is nothing for `setup` to install.
 */
export const ALL_DEPS: readonly Dep[] = [
  wrangler,
  turbo,
  bun,
  doppler,
  stripe,
  pgweb,
  eas,
];

/**
 * Deps required by the CI `provision` phase: Wrangler talks to the
 * Cloudflare API, and Bun + Doppler power the CLI runtime + secrets. The
 * Stripe CLI is unused here (no catalog sync in this phase) and `pgweb`
 * is a local dev GUI that CI runners never install.
 */
export const PROVISION_DEPS: readonly Dep[] = [wrangler, bun, doppler];

/**
 * Deps required by the legacy single-process `deploy` lifecycle: the
 * provision set plus Stripe (for `runStripeSyncPhase`) and the EAS CLI
 * (for the `publish-client-eas-update` phase — OTA `eas update`; the manual
 * `build-client-native` command reuses the same dep). Still excludes
 * `pgweb` (dev-only).
 */
export const DEPLOY_DEPS: readonly Dep[] = [
  wrangler,
  bun,
  doppler,
  stripe,
  eas,
];
