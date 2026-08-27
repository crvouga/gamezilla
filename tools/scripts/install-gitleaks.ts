#!/usr/bin/env bun
// @io-wall-ok — tools composition root
import { ensureGitleaks } from './cli-deps/gitleaks';

await ensureGitleaks();
