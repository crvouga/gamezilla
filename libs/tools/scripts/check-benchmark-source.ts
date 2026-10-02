// @io-wall-ok — benchmark input fingerprint; contents and relative paths only.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function sourceFingerprint(): string {
  const names = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter((name) => name && !name.endsWith('.md'))
    .sort();
  const hash = createHash('sha256');
  for (const name of names) {
    hash.update(name).update('\0');
    try {
      hash.update(readFileSync(name));
    } catch {
      hash.update('<absent>');
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}
