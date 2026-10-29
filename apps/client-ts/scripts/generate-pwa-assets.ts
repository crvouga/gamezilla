// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
/**
 * Generates PWA icons, splash screens and favicon under `public/pwa/` from
 * the app icon. Requires Chromium (pwa-asset-generator / Puppeteer).
 *
 * The manifest is not this script's: it is a brand artifact rendered from the
 * product identity (`@libs/product-identity-shared-ts/brand-artifact-web`).
 * The asset generator only reads it; this script rewrites it from the
 * identity afterwards, so it always matches the brand artifact generator.
 *
 * Invoked via `bunx` so the generator (and its unmaintained `extract-zip`
 * transitive) never enters the lockfile / `ci:audit` graph. Assets are
 * committed so CI / Cloudflare Pages deploys include them without running
 * this script (Puppeteer downloads Chromium, which we don't want in CI).
 *
 * Usage: `bun run pwa:generate` from apps/client-ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEB_BRAND_ARTIFACTS } from '@libs/product-identity-shared-ts/brand-artifact-web';
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { run } from '@pkgs/os-server-ts/command';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';

const log = createLogger({ name: 'client:pwa-assets', now: wallClock.now });

/** Pinned bunx spec — not a workspace dep (extract-zip has no patched release). */
const PWA_ASSET_GENERATOR = 'pwa-asset-generator@8.1.4';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(__dirname, '..');
const iconSource = join(clientRoot, 'src/icon.png');
const publicDir = join(clientRoot, 'public');
/**
 * PWA assets live under `public/pwa/` (not `public/generated/pwa/`) so they
 * are tracked in git. Cloudflare Pages serves the static SPA shell from `dist/`
 * and falls back to `index.html` for unknown paths; if the manifest + icons
 * are not in the deploy artifact, the browser fetches `index.html` for them
 * and reports a "Manifest: Line: 1, column: 1, Syntax error.".
 */
const pwaDir = join(publicDir, 'pwa');
const manifestPath = join(pwaDir, 'manifest.webmanifest');
const indexPath = join(publicDir, 'index.html');

mkdirSync(pwaDir, { recursive: true });

const expectedAssets = [
  join(pwaDir, 'manifest.webmanifest'),
  join(pwaDir, 'favicon-196.png'),
  join(pwaDir, 'apple-icon-180.png'),
  join(pwaDir, 'manifest-icon-192.maskable.png'),
  join(pwaDir, 'manifest-icon-512.maskable.png'),
  join(pwaDir, 'apple-splash-dark-640-1136.png'),
];

function hasAllExpectedAssets(): boolean {
  return expectedAssets.every((filePath) => existsSync(filePath));
}

/** The manifest exactly as the brand artifact generator writes it. */
function writeBrandManifest(): void {
  const artifact = WEB_BRAND_ARTIFACTS.find((candidate) =>
    candidate.path.endsWith('/pwa/manifest.webmanifest')
  );
  if (artifact === undefined)
    throw new Error('no manifest among the web brand artifacts');
  writeFileSync(manifestPath, artifact.render(PRODUCT));
}

writeBrandManifest();

function generatePwaImages(): void {
  run(
    process.execPath,
    [
      'x',
      PWA_ASSET_GENERATOR,
      iconSource,
      pwaDir,
      '--manifest',
      manifestPath,
      '--index',
      indexPath,
      '--path-override',
      '/pwa',
      '--favicon',
      '--maskable',
      '--dark-mode',
      '--background',
      COLOR_PALETTE.light.surface,
      '--type',
      'png',
      '--scrape',
      'false',
      '--log',
    ],
    { cwd: clientRoot }
  );
}

if (!hasAllExpectedAssets()) {
  generatePwaImages();
  log.info(`PWA assets generated under ${pwaDir}`);
} else {
  log.info(`Up-to-date: ${pwaDir}`);
}

/** pwa-asset-generator may emit protocol-relative `//file` URLs. */
function fixProtocolRelativeUrls(filePath: string): void {
  const before = readFileSync(filePath, 'utf8');
  const after = before
    .replaceAll('href="//', 'href="/')
    .replaceAll('"//', '"/');
  if (after !== before) {
    writeFileSync(filePath, after);
  }
}

fixProtocolRelativeUrls(indexPath);
writeBrandManifest();
