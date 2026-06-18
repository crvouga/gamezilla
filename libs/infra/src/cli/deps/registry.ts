import { BunDep } from './bun';
import { VaultDep } from './vault';
import { EasDep } from './eas';
import { StripeDep } from './stripe';
import type { Dep } from './types';
import { TurboDep } from './turbo';
import { WranglerDep } from './wrangler';

const wrangler = new WranglerDep();
const turbo = new TurboDep();
const bun = new BunDep();
const vault = new VaultDep();
const stripe = new StripeDep();
const eas = new EasDep();

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
  vault,
  stripe,
  eas,
];

/**
 * Deps required by the CI `provision` phase: Wrangler talks to the
 * Cloudflare API, and Bun + Vault power the CLI runtime + secrets. The
 * Stripe CLI is unused here (no catalog sync in this phase).
 */
export const PROVISION_DEPS: readonly Dep[] = [wrangler, bun, vault];

/**
 * Deps required by the legacy single-process `deploy` lifecycle: the
 * provision set plus Stripe (for `runStripeSyncPhase`) and the EAS CLI
 * (for the `publish-client-eas-update` phase — OTA `eas update`; the manual
 * `build-client-native` command reuses the same dep).
 */
export const DEPLOY_DEPS: readonly Dep[] = [wrangler, bun, vault, stripe, eas];
