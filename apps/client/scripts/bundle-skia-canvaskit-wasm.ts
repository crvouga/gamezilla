// @io-wall-ok — composition-root wall FS via ObjectStore migration pending
/**
 * Copies Skia's CanvasKit wasm into `public/generated/skia/` for
 * `loadSkiaWebOnce` in `@pkgs/ui-rn/components/skia-web-root`.
 *
 * Skia web defaults to fetching from same-origin assets, so we serve it from
 * `/generated/skia/canvaskit.wasm`.
 *
 * IMPORTANT: we resolve `canvaskit-wasm` from inside
 * `@shopify/react-native-skia` rather than from the app's direct dependency.
 * Shopify ships its own pinned `canvaskit-wasm` JS loader; the app may
 * (transitively or via expo install) end up with a different version. The JS
 * loader's ABI is tied to a specific WASM build, so a mismatched WASM produces
 * subtle runtime failures (e.g. `CanvasKit.Font is not a constructor`).
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
  name: 'client:bundle-skia-canvaskit-wasm',
  now: wallClock.now,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(__dirname, '..');
const generatedSkiaDir = join(clientRoot, 'public', 'generated', 'skia');

mkdirSync(generatedSkiaDir, { recursive: true });

const clientRequire = createRequire(join(clientRoot, 'package.json'));
// Anchor a second `require` inside `@shopify/react-native-skia` so the
// canvaskit-wasm we copy matches the JS loader Shopify uses at runtime.
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
