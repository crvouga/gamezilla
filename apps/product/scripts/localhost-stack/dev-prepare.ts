// @io-wall-ok — development process entry.
import { join } from 'node:path';
import { devStackOptions } from './dev-options';
import { removeManifest } from './manifest';

const options = devStackOptions();
removeManifest(join(import.meta.dir, '../../../..'), options.instanceId);
