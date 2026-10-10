// @io-wall-ok — development process entry.
import { existsSync } from 'node:fs';
import { devStackOptions } from './dev-options';
import { resolveDevRepoRoot } from './dev-repo-root';
import { removeManifest } from './manifest';

const options = devStackOptions();
removeManifest(
  resolveDevRepoRoot(import.meta.dir, existsSync),
  options.instanceId
);
