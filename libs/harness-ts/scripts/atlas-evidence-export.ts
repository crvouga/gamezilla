// @io-wall-ok — Atlas static-site evidence composition.
import { resolve } from 'node:path';
import { exportEvidence } from '@crvouga/atlas/reports/export-evidence';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { workspaceOutline } from './atlas-outline';
import { openReportsDevApp } from './atlas-reports-app';
import { workspaceReports } from './atlas-workspace-reports';

const root = resolve(import.meta.dir, '../../..');
const output = process.argv[2];
if (!output) throw new Error('Supply the Atlas evidence output directory');
const workspace = await workspaceReports(root);
const outline = await workspaceOutline(root);
const app = await openReportsDevApp(
  root,
  async () => workspace,
  async () => outline
);
const result = await exportEvidence({
  fetch: (path) =>
    Promise.resolve(app.fetch(new Request(`http://atlas/api/reports${path}`))),
  target: createNodeFsObjectStore({
    rootDir: resolve(output),
    fs: wallNodeFs(),
    layout: 'tree',
  }),
});
console.log(
  `Atlas evidence: ${result.layers} layers across ${result.revisions} revisions exported; ${result.missing.length} unavailable artifacts remain visibly missing.`
);
