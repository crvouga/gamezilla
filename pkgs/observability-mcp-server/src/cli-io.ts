#!/usr/bin/env bun
// @io-wall-ok — stdio MCP composition root owns process I/O and wall adapters.

import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { wallClock } from '@pkgs/clock-shared/wall';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared/ndjson';
import { TempoTraceStore } from '@pkgs/observability-root-shared/tempo';
import type { TraceStore } from '@pkgs/observability-root-shared/types';

import { createObservabilityMcpServer } from './server';

function tempoStore(url: string): TraceStore {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('OBS_TEMPO_URL must use http:// or https://');
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new Error('OBS_TEMPO_URL must not contain credentials');
  }
  const token = process.env['OBS_TEMPO_TOKEN'];
  const username = process.env['OBS_TEMPO_USER'];
  if (username !== undefined && token === undefined) {
    throw new Error('OBS_TEMPO_USER requires OBS_TEMPO_TOKEN');
  }
  return new TempoTraceStore({
    baseUrl: parsed.toString().replace(/\/$/, ''),
    fetch: globalThis.fetch,
    now: wallClock.now,
    ...(token === undefined ? {} : { token }),
    ...(username === undefined ? {} : { username }),
  });
}

function artifactStore(path: string): TraceStore {
  const source = resolve(path);
  return new NdjsonTraceStore(
    createNodeFsObjectStore({
      rootDir: source,
      fs: wallNodeFs(),
      layout: 'tree',
    }),
    source
  );
}

function createStore(): TraceStore {
  const requested = process.env['OBS_TRACE_SOURCE'];
  const tempoUrl = process.env['OBS_TEMPO_URL'];
  if (requested === 'prod' || requested === 'tempo') {
    if (tempoUrl === undefined) {
      throw new Error('OBS_TEMPO_URL is required for the Tempo MCP source');
    }
    return tempoStore(tempoUrl);
  }
  if (requested !== undefined) return artifactStore(requested);
  return tempoUrl === undefined
    ? artifactStore('.observability')
    : tempoStore(tempoUrl);
}

function createServer(): McpServer {
  return createObservabilityMcpServer(createStore());
}

serveStdio(createServer, {
  onerror(error) {
    process.stderr.write(`observability MCP error: ${error.message}\n`);
  },
});
