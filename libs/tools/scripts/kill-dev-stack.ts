#!/usr/bin/env bun
/**
 * Reclaim every local dev listener after `turbo dev` or when shutdown hangs.
 * Runs per-package `kill` tasks, then SIGKILLs anything still bound to dev ports.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { killAllEsbuildServices } from '@pkgs/os-server/kill-orphan-esbuild';
import { killListenersOnPorts } from '@pkgs/os-server/kill-port';

const REPO_ROOT = join(import.meta.dirname, '../../..');

const DEV_PORTS = [
  8788, // wrangler API
  9231, // wrangler inspector
  5173, // Vite web dev / static preview (PREVIEW_PORT)
  5174, // legacy Vite web dev
  8799, // observability collector
  1883, // EMQX MQTT TCP (fidelity-max / CI)
  8083, // EMQX MQTT WebSocket
  18083, // EMQX dashboard / HTTP API
  15432, // Mockingbird Postgres
] as const;

function runTurboKill(): void {
  try {
    execSync('turbo run kill --continue=always', {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
  } catch {
    // turbo may be absent or already torn down
  }
}

function pkillOrphans(): void {
  const patterns = [
    '[t]urbo dev',
    '[w]rangler dev',
    '[e]xpo start',
    '[s]tripe listen',
    '[e]mqx foreground',
    '[s]3rver',
  ];
  for (const pattern of patterns) {
    try {
      execSync(`pkill -f '${pattern}'`, { stdio: 'ignore' });
    } catch {
      // no matching processes
    }
  }
}

runTurboKill();
pkillOrphans();
killListenersOnPorts([...DEV_PORTS]);
killAllEsbuildServices({ commandIncludes: REPO_ROOT });
