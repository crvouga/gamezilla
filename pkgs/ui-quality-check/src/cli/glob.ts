import { isAbsolute, join, resolve } from 'node:path';
import type { Files } from '../files';

function expression(pattern: string): RegExp {
  let out = '^';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*' && pattern[i + 2] === '/') {
      out += '(?:.*/)?';
      i += 2;
    } else if (c === '*' && pattern[i + 1] === '*') {
      out += '.*';
      i++;
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += (c ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`${out}$`);
}

export async function expandGlobs(
  files: Files,
  inputs: readonly string[]
): Promise<readonly string[]> {
  const result: string[] = [];
  for (const input of inputs) {
    if (!/[?*]/.test(input)) {
      result.push(input);
      continue;
    }
    const normalized = input.replace(/\\/g, '/');
    const first = normalized.search(/[?*]/);
    const slash = normalized.lastIndexOf('/', first);
    const root = slash < 0 ? '.' : normalized.slice(0, slash) || '/';
    const match = expression(
      isAbsolute(input) ? normalized : resolve(input).replace(/\\/g, '/')
    );
    const paths = await files.list(root);
    const found = paths.filter((path) =>
      match.test(resolve(join(path)).replace(/\\/g, '/'))
    );
    if (!found.length) throw new Error(`Glob matched no files: ${input}`);
    result.push(...found);
  }
  return result;
}
