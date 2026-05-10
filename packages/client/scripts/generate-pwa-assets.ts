/**
 * Generates PWA icons, splash screens, favicon, and manifest under
 * `public/generated/pwa/` from the app icon. Requires Chromium
 * (pwa-asset-generator / Puppeteer).
 *
 * Usage: `bun run pwa:generate` from packages/client
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImages } from 'pwa-asset-generator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(__dirname, '..');
const iconSource = join(clientRoot, 'src/assets/images/icon.png');
const publicDir = join(clientRoot, 'public');
const generatedPwaDir = join(publicDir, 'generated', 'pwa');
const manifestPath = join(generatedPwaDir, 'manifest.webmanifest');
const indexPath = join(publicDir, 'index.html');

mkdirSync(generatedPwaDir, { recursive: true });

const expectedAssets = [
  join(generatedPwaDir, 'manifest.webmanifest'),
  join(generatedPwaDir, 'favicon-196.png'),
  join(generatedPwaDir, 'apple-icon-180.png'),
  join(generatedPwaDir, 'manifest-icon-192.maskable.png'),
  join(generatedPwaDir, 'manifest-icon-512.maskable.png'),
  join(generatedPwaDir, 'apple-splash-dark-640-1136.png'),
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
  const result = await generateImages(iconSource, generatedPwaDir, {
    manifest: manifestPath,
    index: indexPath,
    pathOverride: '/generated/pwa',
    favicon: true,
    maskable: true,
    darkMode: true,
    background: '#FAFAFA',
    type: 'png',
    scrape: false,
    log: true,
  });

  // eslint-disable-next-line no-console -- script output
  console.log(
    `PWA assets: ${result.savedImages?.length ?? 0} images, manifest updated`
  );
} else {
  // eslint-disable-next-line no-console -- script output
  console.log(`Up-to-date: ${generatedPwaDir}`);
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
