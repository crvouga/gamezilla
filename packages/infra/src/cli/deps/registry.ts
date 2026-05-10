import { BunDep } from './bun';
import { DopplerDep } from './doppler';
import { PgwebDep } from './pgweb';
import { PostgresDep } from './postgres';
import { StripeDep } from './stripe';
import type { Dep } from './types';
import { WranglerDep } from './wrangler';

const wrangler = new WranglerDep();
const bun = new BunDep();
const doppler = new DopplerDep();
const stripe = new StripeDep();
const postgres = new PostgresDep();
const pgweb = new PgwebDep();

/**
 * Every CLI dep the toolchain knows about. Used by `setup` (installs
 * everything on a developer workstation) and `status` (reports the full
 * matrix). CI phase commands should NOT use this list directly — they
 * deliberately install only a subset (e.g. `provision` skips `stripe`
 * + `pgweb`) and must check the matching subset via `PROVISION_DEPS`
 * / `DEPLOY_DEPS` so `runCheckDepsPhase` doesn't fail on tools the
 * runner never installed.
 */
export const ALL_DEPS: readonly Dep[] = [
  wrangler,
  bun,
  doppler,
  stripe,
  postgres,
  pgweb,
];

/**
 * Deps required by the CI `provision` phase: Wrangler talks to the
 * Cloudflare API, Bun + Doppler power the CLI runtime + secrets, and
 * Postgres binaries back the global deploy lock (`packages/pg`). The
 * Stripe CLI is unused here (no catalog sync in this phase) and
 * `pgweb` is a local dev GUI that CI runners never install.
 */
export const PROVISION_DEPS: readonly Dep[] = [wrangler, bun, doppler, postgres];

/**
 * Deps required by the legacy single-process `deploy` lifecycle: the
 * provision set plus Stripe (for `runStripeSyncPhase`). Still excludes
 * `pgweb` (dev-only).
 */
export const DEPLOY_DEPS: readonly Dep[] = [
  wrangler,
  bun,
  doppler,
  postgres,
  stripe,
];
