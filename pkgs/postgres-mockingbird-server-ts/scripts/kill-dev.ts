// @io-wall-ok — checkout-scoped resource stop entry.
import { join } from 'node:path';
import { gcDevOwner } from '@pkgs/dev-owner-server-ts/dev-owner-gc';

await gcDevOwner(join(import.meta.dirname, '../../..'), true);
