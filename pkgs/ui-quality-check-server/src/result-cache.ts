import { join } from 'node:path';
import type { ResolvedOptions } from '@pkgs/ui-quality-check-shared/config';
import type { DetectorInfo } from '@pkgs/ui-quality-check-shared/detectors-types';
import type { Files } from './files';
import { hashBytes, hashFile, readJson, writeJson } from './files';
import type { QualityResult } from '@pkgs/ui-quality-check-shared/ui-quality-check-types';

export async function resultKey(args: {
  files: Files;
  input: string;
  config: ResolvedOptions;
  detectors: readonly DetectorInfo[];
  decoderVersion: string;
  signal?: AbortSignal;
}): Promise<string> {
  const inputHash = await hashFile(args.files, args.input, args.signal);
  return hashBytes(
    JSON.stringify({
      packageVersion: '0.1.0',
      preprocessing: 'rgb-cubic-window-v1',
      sampling: 'select-pts-grid64-tiles8-v1',
      inputHash,
      config: args.config,
      detectors: args.detectors,
      decoderVersion: args.decoderVersion,
    })
  );
}

export async function cachedResult(
  files: Files,
  directory: string,
  key: string
): Promise<QualityResult | null> {
  if (!(await files.store(directory).head(`${key}.json`))) return null;
  try {
    const cached = await readJson<{ checksum: string; result: QualityResult }>(
      files,
      join(directory, `${key}.json`)
    );
    if (
      cached.checksum !== hashBytes(JSON.stringify(cached.result)) ||
      cached.result.schemaVersion !== 1 ||
      cached.result.cacheKey !== key ||
      !Array.isArray(cached.result.frames) ||
      !cached.result.frames.length
    )
      return null;
    return cached.result;
  } catch {
    return null;
  }
}

export async function cacheResult(
  files: Files,
  directory: string,
  result: QualityResult
): Promise<void> {
  if (!result.cacheKey) return;
  await writeJson(files, join(directory, `${result.cacheKey}.json`), {
    checksum: hashBytes(JSON.stringify(result)),
    result,
  });
}
