// @io-wall-ok — build entrypoint; published output has no workspace dependencies.
import { mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await build({
  entryPoints: {
    api: 'src/api.ts',
    cli: 'src/cli.ts',
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
