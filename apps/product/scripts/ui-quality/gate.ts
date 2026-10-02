import { createHash } from 'node:crypto';
import { readObjectBytes, writeUtf8 } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { QualityResult, UIQualityChecker } from 'ui-quality-check';
import type { SnapshotRenderer } from './render';
import type {
  ArtifactManifest,
  ArtifactScore,
  VisualArtifact,
  VisualGateResult,
} from './types';

export interface GatePorts {
  readonly inputs: ObjectStore;
  readonly output: ObjectStore;
  readonly renderer: SnapshotRenderer;
  readonly checker: Pick<UIQualityChecker, 'checkImages' | 'checkVideos'>;
  readonly inputPath: (file: string) => string;
  readonly diagnosticKey: (file: string) => string;
  readonly threshold: number;
  readonly batchSize: number;
  readonly signal?: AbortSignal;
}

async function bytes(
  ports: GatePorts,
  artifact: VisualArtifact
): Promise<Uint8Array> {
  ports.signal?.throwIfAborted();
  const input = await readObjectBytes(ports.inputs, artifact.file);
  if (input === null)
    throw new Error(`Missing UI quality input: ${artifact.file}`);
  return artifact.kind === 'html'
    ? ports.renderer.render(new TextDecoder().decode(input))
    : input;
}

async function scoreImages(
  ports: GatePorts,
  artifacts: readonly VisualArtifact[],
  scores: Map<string, QualityResult>
): Promise<readonly ArtifactScore[]> {
  const images: Uint8Array[] = [];
  for (const artifact of artifacts) images.push(await bytes(ports, artifact));
  const hashes = images.map((image) =>
    createHash('sha256').update(image).digest('hex')
  );
  const results = await scoreUniqueImages(ports, images, hashes, scores);
  const out: ArtifactScore[] = [];
  for (const [index, artifact] of artifacts.entries()) {
    const result = results[index]!;
    const failureImage = `failures/${artifact.hash}.png`;
    if (!result.pass) {
      const path = result.worstFrames[0]?.artifact;
      const png = path
        ? await readObjectBytes(ports.output, ports.diagnosticKey(path))
        : images[index]!;
      if (png === null) throw new Error(`Missing failure image: ${path}`);
      await ports.output.put(failureImage, png, 'image/png');
    }
    out.push({ artifact, result, ...(!result.pass ? { failureImage } : {}) });
  }
  return out;
}

async function scoreUniqueImages(
  ports: GatePorts,
  images: readonly Uint8Array[],
  hashes: readonly string[],
  scores: Map<string, QualityResult>
): Promise<readonly QualityResult[]> {
  const missing = new Map<string, Uint8Array>();
  for (const [i, hash] of hashes.entries())
    if (!scores.has(hash)) missing.set(hash, images[i]!);
  if (missing.size) {
    ports.signal?.throwIfAborted();
    const batch = await ports.checker.checkImages([...missing.values()]);
    if (batch.results.length !== missing.size)
      throw new Error('UI quality scorer returned an incomplete batch.');
    for (const [i, hash] of [...missing.keys()].entries())
      scores.set(hash, batch.results[i]!);
  }
  return hashes.map((hash) => scores.get(hash)!);
}

export async function runVisualGate(
  manifest: ArtifactManifest,
  ports: GatePorts
): Promise<VisualGateResult> {
  if (!manifest.artifacts.length)
    throw new Error(
      'UI quality gate has no visual inputs; refusing an empty pass.'
    );
  if (!Number.isInteger(ports.batchSize) || ports.batchSize < 1)
    throw new Error('UI quality batch size must be a positive integer.');
  const results: ArtifactScore[] = [];
  const scores = new Map<string, QualityResult>();
  const images = manifest.artifacts.filter((a) => a.kind !== 'video');
  for (let index = 0; index < images.length; index += ports.batchSize) {
    results.push(
      ...(await scoreImages(
        ports,
        images.slice(index, index + ports.batchSize),
        scores
      ))
    );
  }
  const videos = manifest.artifacts.filter((a) => a.kind === 'video');
  if (videos.length) {
    ports.signal?.throwIfAborted();
    const batch = await ports.checker.checkVideos(
      videos.map((v) => ports.inputPath(v.file))
    );
    if (batch.results.length !== videos.length)
      throw new Error('UI quality scorer returned incomplete videos.');
    for (const [index, artifact] of videos.entries()) {
      const result = batch.results[index]!;
      const path = result.worstFrames[0]?.artifact;
      results.push({
        artifact,
        result,
        ...(path ? { failureImage: ports.diagnosticKey(path) } : {}),
      });
    }
  }
  results.sort((a, b) =>
    a.artifact.hash < b.artifact.hash
      ? -1
      : a.artifact.hash > b.artifact.hash
        ? 1
        : 0
  );
  const result: VisualGateResult = {
    schemaVersion: 1,
    pass: results.every((r) => r.result.pass),
    threshold: ports.threshold,
    thresholdBasis: 'experimental-neutral-prompt-boundary',
    reports: manifest.reports,
    references: manifest.references,
    inputsAnalyzed: results.length,
    uniqueImagesScored: scores.size,
    results,
  };
  await writeUtf8(
    ports.output,
    'result.json',
    `${JSON.stringify(result, null, 2)}\n`,
    'application/json'
  );
  return result;
}
