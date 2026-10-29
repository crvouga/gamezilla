#!/usr/bin/env bun
// @io-wall-ok — CLI: opens the repository's GitHub Actions page in a browser.
/** `bun gh`: the Actions page of the source repository (product identity). */
import { spawnSync } from 'node:child_process';
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';

const url = `https://github.com/${PRODUCT.external.sourceRepository}/actions`;
const opened = spawnSync('bun', ['x', 'open', url], { stdio: 'inherit' });
process.exit(opened.status ?? 1);
