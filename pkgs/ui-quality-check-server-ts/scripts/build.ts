// @io-wall-ok — build entrypoint; published output has no workspace dependencies.
import { mkdir } from 'node:fs/promises';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { build } from 'esbuild';

removeTree('dist');
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
