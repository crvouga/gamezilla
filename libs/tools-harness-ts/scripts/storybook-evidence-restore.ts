// @io-wall-ok — local authenticated evidence transfer entry point.
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { renameReplacing } from '@pkgs/fs-server-ts/rename-replacing';
import { evidenceLines, streamEvidence } from './storybook-evidence-stream';

export async function restoreEvidence(
  logPath: string,
  targetDirectory: string,
  keyPath: string
): Promise<void> {
  const destination = resolve(targetDirectory);
  if (existsSync(destination)) throw new Error('Destination must not exist');
  const privateKey = readFileSync(keyPath, 'utf8');
  mkdirSync(dirname(destination), { recursive: true });
  const staging = mkdtempSync(`${destination}.partial-`);
  const input = createReadStream(logPath, { encoding: 'utf8' });
  const lines = evidenceLines(input);
  try {
    const manifest = await streamEvidence(
      lines,
      privateKey,
      ({ path, bytes }) => {
        const target = resolve(staging, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, bytes, { flag: 'wx' });
      }
    );
    writeFileSync(
      resolve(staging, 'evidence-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: 'wx' }
    );
    if (existsSync(destination)) throw new Error('Destination must not exist');
    renameReplacing(staging, destination);
    console.log(
      `Restored ${manifest.files.length} checksum-verified evidence files`
    );
  } finally {
    input.destroy();
    removeTree(staging);
  }
}
