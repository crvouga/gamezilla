#!/usr/bin/env bun
// @io-wall-ok — tools composition root
import { installCliDeps } from '@pkgs/os';
import { ALL_CLI_DEPS } from './cli-deps/registry';

await installCliDeps(ALL_CLI_DEPS);
