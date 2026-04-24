/**
 * Generates PWA icons, splash screens, favicon, and manifest under `public/`
 * from the app icon. Requires Chromium (pwa-asset-generator / Puppeteer).
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
const manifestPath = join(publicDir, 'manifest.webmanifest');
const indexPath = join(publicDir, 'index.html');

mkdirSync(publicDir, { recursive: true });
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

const result = await generateImages(iconSource, publicDir, {
  manifest: manifestPath,
  index: indexPath,
  favicon: true,
  maskable: true,
  darkMode: true,
  background: '#FAFAFA',
  type: 'png',
  scrape: false,
  log: true,
});

/** pwa-asset-generator may emit protocol-relative `//file` URLs when pathOverride is omitted. */
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

// eslint-disable-next-line no-console -- script output
console.log(
  `PWA assets: ${result.savedImages?.length ?? 0} images, manifest updated`
);
