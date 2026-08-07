/**
 * Generates PWA icons, splash screens, favicon, and manifest under
 * `public/pwa/` from the app icon. Requires Chromium
 * (pwa-asset-generator / Puppeteer).
 *
 * The output directory is committed to git so CI / Cloudflare Pages deploys
 * always include the manifest + icons even when this script is not run as
 * part of the build (Puppeteer downloads Chromium, which we don't want in CI).
 *
 * Usage: `bun run pwa:generate` from apps/client
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImages } from 'pwa-asset-generator';

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

if (!hasAllExpectedAssets()) {
  const result = await generateImages(iconSource, pwaDir, {
    manifest: manifestPath,
    index: indexPath,
    pathOverride: '/pwa',
    favicon: true,
    maskable: true,
    darkMode: true,
    background: '#FAFAFA',
    type: 'png',
    scrape: false,
    log: true,
  });

  console.log(
    `PWA assets: ${result.savedImages?.length ?? 0} images, manifest updated`
  );
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
