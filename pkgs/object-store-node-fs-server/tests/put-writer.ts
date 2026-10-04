// @io-wall-ok — child process for cross-process-put.test.ts
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';

const [rootDir, puts] = process.argv.slice(2);
if (rootDir === undefined || puts === undefined) {
  throw new Error('usage: put-writer <rootDir> <puts>');
}
const store = createNodeFsObjectStore({
  rootDir,
  fs: wallNodeFs(),
  layout: 'tree',
});
const body = new TextEncoder().encode('x'.repeat(64 * 1024));
for (let i = 0; i < Number(puts); i++) {
  await store.put('seed.json', body, 'application/json');
}
