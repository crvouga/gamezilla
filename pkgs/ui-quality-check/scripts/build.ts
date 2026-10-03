// @io-wall-ok — build entrypoint; published output has no workspace dependencies.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { publicDeclarations } from './declarations';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await build({
  entryPoints: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
    harness: 'src/harness/index.ts',
  },
  outdir: 'dist',
  platform: 'node',
  target: 'node22',
  format: 'esm',
  bundle: true,
  splitting: true,
  external: ['sharp', 'ffmpeg-static', 'onnxruntime-node'],
  sourcemap: true,
});
await writeFile('dist/index.d.ts', publicDeclarations('src/index.ts'));

await writeFile(
  'dist/harness.d.ts',
  publicDeclarations('src/harness/index.ts')
);
