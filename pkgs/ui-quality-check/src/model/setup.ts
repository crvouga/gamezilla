import { join } from 'node:path';
import type { HttpClient } from '@pkgs/http-client';
import manifest from '../../assets/manifest.json';
import entries from '../../assets/weights.json';
import type { Files } from '../files';
import { hashBytes, hashFile, readBytes, writeBytes } from '../files';

export interface SetupOptions {
  readonly modelDir?: string;
  /** Offline setup from the pinned official safetensors checkpoint. */
  readonly sourcePath?: string;
  readonly signal?: AbortSignal;
}

interface SafeTensor {
  dtype: string;
  shape: number[];
  data_offsets: [number, number];
}

function convertWeights(source: Uint8Array): Uint8Array {
  const view = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength
  );
  const headerLength = Number(view.getBigUint64(0, true));
  const header = JSON.parse(
    new TextDecoder().decode(source.subarray(8, 8 + headerLength))
  ) as Record<string, SafeTensor>;
  const weights = new Uint8Array(manifest.weightsBytes);
  for (const entry of entries) {
    const tensor = header[entry.tensor];
    if (!tensor || tensor.dtype !== 'F32')
      throw new Error(`Invalid pinned tensor: ${entry.tensor}`);
    const start = 8 + headerLength + tensor.data_offsets[0];
    const raw = source.subarray(start, start + entry.length);
    if (!entry.transpose) {
      weights.set(raw, entry.offset);
      continue;
    }
    const rows = tensor.shape[0] ?? 0;
    const columns = tensor.shape[1] ?? 0;
    if (rows * columns * 4 !== entry.length)
      throw new Error(`Invalid matrix shape: ${entry.tensor}`);
    // Bytewise transpose also works on big-endian hosts: ONNX weights are little-endian.
    const input = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const output = new DataView(weights.buffer, entry.offset, entry.length);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++)
        output.setUint32(
          (column * rows + row) * 4,
          input.getUint32((row * columns + column) * 4, true),
          true
        );
    }
  }
  return weights;
}

export async function verifyModel(
  files: Files,
  modelDir: string,
  signal?: AbortSignal
): Promise<void> {
  try {
    if (
      (await hashFile(files, join(modelDir, 'vision.onnx'), signal)) !==
      manifest.graphSha256
    )
      throw new Error('graph checksum mismatch');
    if (
      (await hashFile(files, join(modelDir, 'vision.data'), signal)) !==
      manifest.weightsSha256
    )
      throw new Error('weights checksum mismatch');
  } catch (error) {
    signal?.throwIfAborted();
    throw new Error(
      `Model missing or corrupt in ${modelDir}. Run "ui-quality-check setup" with the same model directory.`,
      { cause: error }
    );
  }
}

export async function prepareModel(args: {
  files: Files;
  http: HttpClient;
  modelDir: string;
  assetDir: string;
  options: SetupOptions;
}) {
  const { files, http, modelDir, assetDir, options } = args;
  options.signal?.throwIfAborted();
  if (
    (await files.store(modelDir).head('vision.data')) &&
    (await files.store(modelDir).head('vision.onnx'))
  ) {
    try {
      await verifyModel(files, modelDir, options.signal);
      return { ...manifest, modelDir, installed: false };
    } catch {
      // Explicit setup repairs corrupt installations; checks never download.
      options.signal?.throwIfAborted();
    }
  }
  let source: Uint8Array;
  if (options.sourcePath) source = await readBytes(files, options.sourcePath);
  else {
    const response = await http.fetch(
      manifest.sourceUrl,
      options.signal ? { signal: options.signal } : {}
    );
    if (!response.ok)
      throw new Error(
        `Model setup download failed: HTTP ${response.status}. URL: ${manifest.sourceUrl}`
      );
    source = new Uint8Array(await response.arrayBuffer());
  }
  options.signal?.throwIfAborted();
  if (
    source.length !== manifest.sourceBytes ||
    hashBytes(source) !== manifest.sourceSha256
  )
    throw new Error(
      'Model setup rejected the checkpoint: SHA256 or length mismatch.'
    );
  const weights = convertWeights(source);
  if (hashBytes(weights) !== manifest.weightsSha256)
    throw new Error(
      'Converted model checksum mismatch; no model was installed.'
    );
  const graph = await readBytes(files, join(assetDir, 'vision.onnx'));
  if (hashBytes(graph) !== manifest.graphSha256)
    throw new Error(
      'Bundled model graph checksum mismatch. Reinstall ui-quality-check.'
    );
  options.signal?.throwIfAborted();
  await writeBytes(files, join(modelDir, 'vision.data'), weights);
  await writeBytes(files, join(modelDir, 'vision.onnx'), graph);
  return { ...manifest, modelDir, installed: true };
}
