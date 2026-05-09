/**
 * Copies Skia's CanvasKit wasm into `public/` for `loadSkiaWebOnce` in
 * `src/ui/skia-web-root.tsx` (and legacy `WithSkiaWeb`).
 *
 * Skia web defaults to fetching from `/canvaskit.wasm` (same origin). Expo web
 * serves `public/` at the site root, so we copy the dependency wasm there.
 *
 * IMPORTANT: we resolve `canvaskit-wasm` from inside
 * `@shopify/react-native-skia` rather than from the app's direct dependency.
 * Shopify ships its own pinned `canvaskit-wasm` JS loader; the app may
 * (transitively or via expo install) end up with a different version. The JS
 * loader's ABI is tied to a specific WASM build, so a mismatched WASM produces
 * subtle runtime failures (e.g. `CanvasKit.Font is not a constructor`).
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(__dirname, '..');
const publicDir = join(clientRoot, 'public');

mkdirSync(publicDir, { recursive: true });

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
const wasmDest = join(publicDir, 'canvaskit.wasm');
copyFileSync(wasmSource, wasmDest);
console.log(`Copied ${wasmSource} → ${wasmDest}`);
