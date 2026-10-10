import { createHash } from 'node:crypto';
import type {
  ReportStep,
  RunReport,
} from '@crvouga/atlas-reports/report-types';
import {
  readObjectBytes,
  readUtf8,
  writeUtf8,
} from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import type { ArtifactManifest, ArtifactOrigin, VisualArtifact } from './types';

export interface ReportSource {
  readonly package: string;
  readonly bucket: string;
  readonly store: ObjectStore;
}

function safeKey(key: string): string {
  if (
    !key ||
    key.startsWith('/') ||
    key.includes('\\') ||
    key.split('/').some((p) => p === '..' || p === '.')
  )
    throw new Error(`Invalid report artifact path: ${key}`);
  return key;
}

function references(report: RunReport): readonly ArtifactOrigin[] {
  const out: ArtifactOrigin[] = [];
  const visit = (steps: readonly ReportStep[]) => {
    for (const step of steps) {
      for (const frame of step.frames) {
        for (const snapshot of frame.snapshots) {
          if (snapshot.media !== 'html' && snapshot.media !== 'png') continue;
          out.push({
            package: '',
            bucket: '',
            test: report.meta.testId,
            title: report.meta.title,
            step: step.title,
            ...(report.meta.sourceFile
              ? { source: report.meta.sourceFile }
              : {}),
            ...(snapshot.nodeId ? { actor: snapshot.nodeId } : {}),
            timestampMs: Math.max(
              0,
              frame.capturedAtMs - report.meta.startedAtMs
            ),
            file: safeKey(snapshot.file),
          });
        }
      }
      visit(step.steps);
    }
  };
  visit(report.steps);
  return out;
}

function kindOf(file: string): VisualArtifact['kind'] | null {
  if (/\.html$/i.test(file)) return 'html';
  if (/\.(png|jpe?g)$/i.test(file)) return 'image';
  if (/\.(webm|mp4)$/i.test(file)) return 'video';
  return null;
}

type MutableArtifact = {
  hash: string;
  kind: VisualArtifact['kind'];
  file: string;
  origins: ArtifactOrigin[];
};

async function sourceReferences(source: ReportSource) {
  const completion = await readUtf8(source.store, 'complete.json');
  if (
    completion === null ||
    (JSON.parse(completion) as { status?: unknown }).status !== 0
  )
    throw new Error(
      `Missing successful report completion: ${source.package}/${source.bucket}`
    );
  const keys = await source.store.listKeys();
  const out: ArtifactOrigin[] = [];
  const seen = new Set<string>();
  const recorded = new Map<
    string,
    Pick<ArtifactOrigin, 'test' | 'title' | 'source'>
  >();
  const reportKeys = keys.filter((k) => k.endsWith('/report.json')).sort();
  for (const key of reportKeys) {
    const text = await readUtf8(source.store, key);
    if (text === null) throw new Error(`Missing report: ${key}`);
    const prefix = key.slice(0, -'report.json'.length);
    const report = JSON.parse(text) as RunReport;
    recorded.set(prefix, {
      test: report.meta.testId,
      title: report.meta.title,
      ...(report.meta.sourceFile ? { source: report.meta.sourceFile } : {}),
    });
    for (const origin of references(report)) {
      const file = `${prefix}${origin.file}`;
      seen.add(file);
      out.push({
        ...origin,
        package: source.package,
        bucket: source.bucket,
        file,
      });
    }
  }
  for (const file of keys
    .filter((k) => kindOf(k) !== null && !seen.has(k))
    .sort())
    out.push({
      package: source.package,
      bucket: source.bucket,
      test: file,
      title: file,
      ...recorded.get(`${file.split('/').slice(0, 4).join('/')}/`),
      step: 'recorded artifact',
      timestampMs: 0,
      file,
    });
  return { reports: reportKeys.length, origins: out };
}

async function appendArtifact(args: {
  readonly source: ReportSource;
  readonly origin: ArtifactOrigin;
  readonly files: Map<string, string>;
  readonly output: ObjectStore;
  readonly artifacts: Map<string, MutableArtifact>;
  readonly htmlKey?: (html: string) => Promise<string>;
}): Promise<void> {
  const origin = args.origin;
  const known = args.files.get(origin.file);
  if (known) {
    args.artifacts.get(known)!.origins.push(origin);
    return;
  }
  const bytes = await readObjectBytes(args.source.store, safeKey(origin.file));
  if (bytes === null)
    throw new Error(
      `Missing UI artifact: ${args.source.package}/${args.source.bucket}/${origin.file}`
    );
  const kind = kindOf(origin.file);
  if (kind === null) throw new Error(`Unsupported UI artifact: ${origin.file}`);
  const content =
    kind === 'html' && args.htmlKey
      ? await args.htmlKey(new TextDecoder().decode(bytes))
      : bytes;
  const hash = createHash('sha256').update(kind).update(content).digest('hex');
  args.files.set(origin.file, hash);
  const previous = args.artifacts.get(hash);
  if (previous) {
    previous.origins.push(origin);
    return;
  }
  const target = `inputs/${hash}.${origin.file.split('.').at(-1)?.toLowerCase()}`;
  await args.output.put(
    target,
    bytes,
    kind === 'html' ? 'text/html' : 'application/octet-stream'
  );
  args.artifacts.set(hash, { hash, kind, file: target, origins: [origin] });
}

export async function collectArtifacts(
  sources: readonly ReportSource[],
  output: ObjectStore,
  htmlKey?: (html: string) => Promise<string>
): Promise<ArtifactManifest> {
  const artifacts = new Map<string, MutableArtifact>();
  let reports = 0;
  let count = 0;
  for (const source of sources) {
    const collected = await sourceReferences(source);
    reports += collected.reports;
    count += collected.origins.length;
    const files = new Map<string, string>();
    for (const origin of collected.origins)
      await appendArtifact({
        source,
        origin,
        files,
        output,
        artifacts,
        ...(htmlKey ? { htmlKey } : {}),
      });
  }
  if (!artifacts.size)
    throw new Error(
      'UI quality gate has no recorded visual inputs; refusing an empty pass.'
    );
  const manifest: ArtifactManifest = {
    schemaVersion: 1,
    artifacts: [...artifacts.values()].sort((a, b) =>
      a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0
    ),
    reports,
    references: count,
  };
  await writeUtf8(
    output,
    'manifest.json',
    `${JSON.stringify(manifest)}\n`,
    'application/json'
  );
  return manifest;
}
