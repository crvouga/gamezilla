// @io-wall-ok — composition-root wall FS for Expo public assets
/**
 * Copies Skia's CanvasKit wasm into `product/console/public/generated/skia/` for
 * `loadSkiaWebOnce` in `@pkgs/ui/components/skia-web-root`.
 *
 * Resolves `canvaskit-wasm` from inside `@shopify/react-native-skia` via
 * `@apps/client` (which declares the dep) so the WASM ABI matches Shopify's
 * JS loader.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  type Stats,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';

const log = createLogger({
  name: 'sim:bundle-skia-canvaskit-wasm',
  now: wallClock.now,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const consoleRoot = join(__dirname, '..');
const monorepoRoot = join(consoleRoot, '../..');
const generatedSkiaDir = join(consoleRoot, 'public', 'generated', 'skia');

mkdirSync(generatedSkiaDir, { recursive: true });

const clientRequire = createRequire(
  join(monorepoRoot, 'apps/client/package.json')
);
const skiaPkgPath = clientRequire.resolve(
  '@shopify/react-native-skia/package.json'
);
const skiaRequire = createRequire(skiaPkgPath);
const wasmSource = skiaRequire.resolve(
  'canvaskit-wasm/bin/full/canvaskit.wasm'
);
const wasmDest = join(generatedSkiaDir, 'canvaskit.wasm');

function needsCopy(sourcePath: string, destPath: string): boolean {
  if (!existsSync(destPath)) {
    return true;
  }
  const sourceStat: Stats = statSync(sourcePath);
  const destStat: Stats = statSync(destPath);
  return (
    sourceStat.mtimeMs > destStat.mtimeMs || sourceStat.size !== destStat.size
  );
}

if (needsCopy(wasmSource, wasmDest)) {
  copyFileSync(wasmSource, wasmDest);
  log.info(`Copied ${wasmSource} -> ${wasmDest}`);
} else {
  log.info(`Up-to-date: ${wasmDest}`);
}
