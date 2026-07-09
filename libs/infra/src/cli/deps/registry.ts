import { BunDep } from './bun';
import { InfisicalDep } from './infisical';
import { EasDep } from './eas';
import { StripeDep } from './stripe';
import type { Dep } from './types';
import { TurboDep } from './turbo';
import { PowerSyncDep } from './powersync';
import { WranglerDep } from './wrangler';

const wrangler = new WranglerDep();
const turbo = new TurboDep();
const bun = new BunDep();
const infisical = new InfisicalDep();
const stripe = new StripeDep();
const eas = new EasDep();
const powerSync = new PowerSyncDep();

/**
 * Every CLI dep the toolchain knows about. Used by `setup` (installs
 * everything on a developer workstation) and `status` (reports the full
 * matrix). CI phase commands should NOT use this list directly — they
 * deliberately install only a subset (e.g. `provision` skips `stripe`)
 * and must check the matching subset via `PROVISION_DEPS`
 * / `DEPLOY_DEPS` so `runCheckDepsPhase` doesn't fail on tools the
 * runner never installed.
 */
export const ALL_DEPS: readonly Dep[] = [
  wrangler,
  turbo,
  bun,
  infisical,
  stripe,
  eas,
  powerSync,
];

/**
 * Deps required by the CI `provision` phase: Wrangler talks to the
 * Cloudflare API, and Bun + secret store power the CLI runtime + secrets. The
 * Stripe CLI is unused here (no catalog sync in this phase).
 */
export const PROVISION_DEPS: readonly Dep[] = [wrangler, bun, infisical];

/**
 * Deps required by the legacy single-process `deploy` lifecycle: the
 * provision set plus Stripe (for `runStripeSyncPhase`) and the EAS CLI
 * (for the `publish-client-eas-update` phase — OTA `eas update`; the manual
 * `build-client-native` command reuses the same dep).
 */
export const DEPLOY_DEPS: readonly Dep[] = [
  wrangler,
  bun,
  infisical,
  stripe,
  eas,
  powerSync,
];
