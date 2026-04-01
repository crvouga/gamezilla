import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { SimRecording } from './event-recorder';

const DEFAULT_DIR = '.sim-recordings';

export function getRecordingsDir(): string {
  return process.env.PATCHDB_APP_OUT ?? DEFAULT_DIR;
}

export function saveRecording(recording: SimRecording): void {
  const dir = getRecordingsDir();
  mkdirSync(dir, { recursive: true });
  const safeName = `${recording.id}.json`;
  const path = join(dir, safeName);
  writeFileSync(path, JSON.stringify(recording, null, 2), 'utf-8');
}

export function clearRecordings(): void {
  try {
    rmSync(getRecordingsDir(), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export function loadAllRecordings(): SimRecording[] {
  const dir = getRecordingsDir();
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  const out: SimRecording[] = [];
  for (const name of names) {
    try {
      const raw = readFileSync(join(dir, name), 'utf-8');
      out.push(JSON.parse(raw) as SimRecording);
    } catch {
      // skip bad file
    }
  }
  out.sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
  return out;
}
