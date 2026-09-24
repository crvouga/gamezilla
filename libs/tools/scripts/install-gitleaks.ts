#!/usr/bin/env bun
// @io-wall-ok — composition root
import { ensureGitleaks } from './cli-deps/gitleaks';

await ensureGitleaks();
