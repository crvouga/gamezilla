/**
 * Repository paths are `/`-separated on every OS. Node's `path` functions
 * return `\`-separated paths on Windows, so a path that is compared, stored,
 * hashed, printed for a person or matched against a `/` literal goes through
 * `slashPath` first. Windows file APIs accept `/` as well, so a slash path
 * also opens the file it names on every OS.
 */
export function slashPath(path: string): string {
  return path.replaceAll('\\', '/');
}

/** The last segment of a path, whichever separator it uses. */
export function lastSegment(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
