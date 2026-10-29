#!/usr/bin/env bun
// @io-wall-ok — checkout-scoped stop and orphan collection entry.
import { join } from 'node:path';
import { gcDevOwner } from '@pkgs/dev-owner-server-ts/dev-owner-gc';

await gcDevOwner(
  join(import.meta.dirname, '../../..'),
  !process.argv.includes('--gc')
);
