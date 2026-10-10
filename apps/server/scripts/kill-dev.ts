// @io-wall-ok — package stop delegates to checkout ownership.
import { join } from 'node:path';
import { gcDevOwner } from '@pkgs/os-server/dev-owner-gc';

await gcDevOwner(join(import.meta.dirname, '../../..'), true);
