#!/usr/bin/env bun
// @io-wall-ok — arbitrary long-lived commands use the checkout's existing boot supervisor.
import { join } from 'node:path';
import { enterDevOwner } from '@pkgs/dev-owner-server-ts/dev-owner-entry';
import { superviseDev } from '@pkgs/dev-owner-server-ts/dev-owner-supervisor';

const root = join(import.meta.dirname, '../../..');
const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const command = args.shift();
if (!command) throw new Error('Usage: bun run own -- <command> [arguments]');
await enterDevOwner(root, import.meta.filename, [command, ...args]);
process.exit(await superviseDev(root, command, args));
