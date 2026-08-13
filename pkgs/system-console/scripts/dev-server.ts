// @io-wall-ok — system-console viewer process entry (Bun.serve + env).

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wallTimers } from '@pkgs/clock';

import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { createS3ObjectStore } from '@pkgs/object-store/impl-s3';
import type { ObjectStore } from '@pkgs/object-store/interface';
import {
  LOCAL_REPORT_DATA_DIRNAME,
  resolveLocalReportDataDir,
} from '../src/local-data-dir';
import {
  createSimulationReportServer,
  type ReportBucket,
} from '../src/server/index';
import indexHtml from '../src/web/index.html';

import { SYSTEM_CONSOLE_PORT } from './ports';

const here = dirname(fileURLToPath(import.meta.url));
const reportPkgRoot = resolve(here, '..');

type EnvBucket = {
  readonly id: string;
  readonly label?: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
  readonly endpoint: string;
  readonly region: string;
  readonly rootPrefix?: string;
};

function resolveReportDir(env: NodeJS.ProcessEnv, cwd: string): string {
  const raw = env['REPORT_DIR']?.trim() || env['SIM_REPORT_DIR']?.trim();
  if (raw) return resolve(raw);
  return resolveLocalReportDataDir(cwd);
}

function parseOptionalS3Buckets(env: NodeJS.ProcessEnv): ReportBucket[] {
  const raw = env['SIM_REPORT_BUCKETS']?.trim();
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('SIM_REPORT_BUCKETS must be valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('SIM_REPORT_BUCKETS must be a JSON array');
  }
  const out: ReportBucket[] = [];
  for (const entry of parsed) {
    const b = entry as EnvBucket;
    if (
      !b?.id ||
      !b.accessKeyId ||
      !b.secretAccessKey ||
      !b.bucket ||
      !b.endpoint ||
      !b.region
    ) {
      throw new Error(
        'SIM_REPORT_BUCKETS entries need id, accessKeyId, secretAccessKey, bucket, endpoint, region'
      );
    }
    const store: ObjectStore = createS3ObjectStore({
      accessKeyId: b.accessKeyId,
      secretAccessKey: b.secretAccessKey,
      bucket: b.bucket,
      endpoint: b.endpoint,
      region: b.region,
      rootPrefix: b.rootPrefix ?? `${LOCAL_REPORT_DATA_DIRNAME}/`,
    });
    out.push({
      id: b.id,
      label: b.label ?? b.id,
      store,
    });
  }
  return out;
}

function buildBuckets(
  env: NodeJS.ProcessEnv,
  cwd: string
): {
  readonly buckets: ReportBucket[];
  readonly localRootDir: string;
} {
  const localRootDir = resolveReportDir(env, cwd);
  const local: ReportBucket = {
    id: 'local',
    label: 'Local',
    store: createNodeFsObjectStore({ rootDir: localRootDir }),
    watchRoot: localRootDir,
  };
  return {
    buckets: [local, ...parseOptionalS3Buckets(env)],
    localRootDir,
  };
}

const port = Number(process.env['PORT'] ?? SYSTEM_CONSOLE_PORT);
const cwd = process.cwd();
const { buckets, localRootDir } = buildBuckets(process.env, cwd);
const report = createSimulationReportServer({
  buckets,
  timers: wallTimers,
  now: () => Date.now(),
});

const server = Bun.serve({
  port,
  idleTimeout: 0,
  development: {
    hmr: true,
    console: true,
  },
  routes: {
    '/api/*': (req) => report.fetch(req),
    '/*': indexHtml,
  },
});

const reportDirEnv =
  process.env['REPORT_DIR']?.trim() ||
  process.env['SIM_REPORT_DIR']?.trim() ||
  null;

process.stdout.write(
  `System console → http://127.0.0.1:${server.port}\n` +
    `  local ObjectStore (Node FS) rootDir=${localRootDir}\n` +
    `    cwd=${cwd}\n` +
    `    REPORT_DIR/SIM_REPORT_DIR=${reportDirEnv ?? `(unset → <repo>/${LOCAL_REPORT_DATA_DIRNAME})`}\n` +
    `    layout: runs/index.json, runs/<runId>/tests/<testId>/…\n` +
    `  buckets=${buckets.map((b) => `${b.id} (${b.label})`).join(', ')}\n` +
    `  spa=Bun HTML HMR (${reportPkgRoot}/src/web)\n`
);
