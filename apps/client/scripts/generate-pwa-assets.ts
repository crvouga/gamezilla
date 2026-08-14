// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
/**
 * Generates PWA icons, splash screens, favicon, and manifest under
 * `public/pwa/` from the app icon. Requires Chromium
 * (pwa-asset-generator / Puppeteer).
 *
 * Invoked via `bunx` so the generator (and its unmaintained `extract-zip`
 * transitive) never enters the lockfile / `ci:audit` graph. Assets are
 * committed so CI / Cloudflare Pages deploys include them without running
 * this script (Puppeteer downloads Chromium, which we don't want in CI).
 *
 * Usage: `bun run pwa:generate` from apps/client
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '@pkgs/os/command';

/** Pinned bunx spec — not a workspace dep (extract-zip has no patched release). */
const PWA_ASSET_GENERATOR = 'pwa-asset-generator@8.1.4';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(__dirname, '..');
const iconSource = join(clientRoot, 'src/assets/images/icon.png');
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

if (!existsSync(manifestPath)) {
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        name: 'Gamezilla',
        short_name: 'Gamezilla',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FAFAFA',
        theme_color: '#0A0A0A',
        icons: [],
      },
      null,
      2
    )
  );
}

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
      '#FAFAFA',
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
  console.log(`PWA assets generated under ${pwaDir}`);
} else {
  console.log(`Up-to-date: ${pwaDir}`);
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

fixProtocolRelativeUrls(manifestPath);
fixProtocolRelativeUrls(indexPath);
