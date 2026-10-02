import { extname } from 'node:path';
import type { Files } from '../files';

const IMAGES = new Set(['.png', '.jpg', '.jpeg']);
const VIDEOS = new Set(['.webm', '.mp4']);

export function inputKind(path: string): 'image' | 'video' {
  const extension = extname(path).toLowerCase();
  if (IMAGES.has(extension)) return 'image';
  if (VIDEOS.has(extension)) return 'video';
  throw new Error(`Unsupported visual artifact: ${path}. Expected .png, .jpg, .jpeg, .webm or .mp4.`);
}

export async function discoverInputs(files: Files, inputs: readonly string[]): Promise<readonly string[]> {
  if (!inputs.length) throw new Error('Provide at least one screenshot, video or directory.');
  const paths = new Set<string>();
  for (const input of inputs) {
    const found = await files.list(input);
    if (found.length === 1 && found[0] === input) inputKind(input);
    for (const path of found) {
      if (IMAGES.has(extname(path).toLowerCase()) || VIDEOS.has(extname(path).toLowerCase())) paths.add(path);
    }
  }
  const result = [...paths].sort();
  if (!result.length) throw new Error('No supported screenshots or videos were found. Nothing was checked.');
  return result;
}
