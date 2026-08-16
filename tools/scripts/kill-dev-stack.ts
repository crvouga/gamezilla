#!/usr/bin/env bun
/**
 * Reclaim every local dev listener after `turbo dev` or when shutdown hangs.
 * Runs per-package `kill` tasks, then SIGKILLs anything still bound to dev ports.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { killListenersOnPorts } from '@pkgs/os/kill-port';

const REPO_ROOT = join(import.meta.dirname, '../..');

const DEV_PORTS = [
  8788, // wrangler API
  9231, // wrangler inspector
  5173, // Expo web / Metro + static preview (PREVIEW_PORT)
  5174, // legacy Expo web / Metro
  5556, // dev IdP (DEV_IDP_DEFAULT_PORT)
  8799, // observability collector
  7789, // @pkgs/system-console local report console
  1883, // EMQX MQTT TCP
  8083, // EMQX MQTT WebSocket
  18083, // EMQX dashboard / HTTP API
  15432, // @apps/postgres embedded
  9000, // @apps/minio S3 API
  9001, // @apps/minio console
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
    '[m]inio server',
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
