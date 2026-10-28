import { expect, test } from 'bun:test';
import { once } from 'node:events';
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { workspaceWatchOptions } from '@pkgs/vite-workspace-resolver-server-ts/workspace-watch';
import { createServer } from 'vite';

// regression: dev-fsevents-starves-client
test('watches source without linked copies or runtime output', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'workspace-watch-')));
  let ready: Promise<unknown> | undefined;
  let sourceReady: Promise<void> | undefined;
  for (const directory of ['src', '.cache', '.turbo', '.feedback', 'dist']) {
    mkdirSync(join(root, directory));
    writeFileSync(join(root, directory, 'entry.ts'), 'export const value = 1;');
  }
  symlinkSync(join(root, 'src'), join(root, 'linked-src'), 'dir');
  const server = await createServer({
    root,
    configFile: false,
    server: {
      middlewareMode: true,
      hmr: false,
      watch: { ...workspaceWatchOptions(), ignoreInitial: false },
    },
    plugins: [
      {
        name: 'watch-ready',
        configureServer(dev) {
          ready = once(dev.watcher, 'ready');
          sourceReady = new Promise((resolve) => {
            dev.watcher.on('add', (file) => {
              if (file === join(root, 'src', 'entry.ts')) resolve();
            });
          });
        },
      },
    ],
  });
  try {
    await ready;
    await sourceReady;
    const watched = server.watcher.getWatched();
    expect(server.watcher.options).toMatchObject({
      useFsEvents: false,
      usePolling: false,
    });
    expect(watched).toHaveProperty(join(root, 'src'));
    expect(watched[join(root, 'src')]).toContain('entry.ts');
    for (const directory of [
      'linked-src',
      '.cache',
      '.turbo',
      '.feedback',
      'dist',
    ]) {
      expect(watched[join(root, directory)]).toBeUndefined();
    }
  } finally {
    await server.close();
    removeTree(root, { whenLocked: 'leave' });
  }
});
