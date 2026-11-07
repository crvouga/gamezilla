/** Public chess presentation surfaces; motion injection belongs to fixtures. */
const PUBLIC_BOARD = new Set([
  '@pkgs/chess-board-root-client-ts/chess-board',
  '@pkgs/chess-board-root-client-ts/chess-board-frame',
  '@pkgs/chess-board-root-client-ts/chess-board-sounds',
]);

export function permittedBoardImport(
  path: string,
  typeOnly: boolean,
  name: string
): boolean {
  if (
    name === '@pkgs/chess-board-root-shared-ts/chess-board-types' ||
    name === '@pkgs/chess-board-core-shared-ts/types'
  )
    return typeOnly;
  if (name === '@pkgs/chess-board-root-client-ts/board-motion-context')
    return /\.(example|stories)\.tsx$/.test(path);
  return PUBLIC_BOARD.has(name);
}
