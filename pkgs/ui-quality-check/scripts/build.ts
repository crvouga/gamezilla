// @io-wall-ok — build entrypoint; published output has no workspace dependencies.
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { generateDtsBundle } from 'dts-bundle-generator';

await mkdir('dist', { recursive: true });
await build({ entryPoints: { index: 'src/index.ts', cli: 'src/cli/index.ts' }, outdir: 'dist', platform: 'node', target: 'node22', format: 'esm', bundle: true, splitting: true, external: ['sharp', 'ffmpeg-static', 'onnxruntime-node'], sourcemap: true });
const declarations = generateDtsBundle([{ filePath: 'src/index.ts', output: { noBanner: true } }], { preferredConfigPath: 'tsconfig.tc.json' });
await writeFile('dist/index.d.ts', declarations[0] ?? '');
