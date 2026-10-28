/**
 * A repository path as RegExp source matching it under either separator:
 * Bun hands a plugin `\`-separated paths on Windows.
 */
export function pathPattern(path: string): string {
  return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('/', '[\\\\/]');
}
