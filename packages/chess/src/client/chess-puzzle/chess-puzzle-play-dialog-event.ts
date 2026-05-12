/**
 * Event taxonomy for {@link getPuzzlePlayDialog}. Lives in its own module so
 * the registry (`chess-puzzle-play-dialog.ts`) and the message data
 * (`chess-puzzle-play-dialog-content.ts`) can both import it without forming
 * a cycle — `tsPreCompilationDeps` in `.dependency-cruiser.cjs` counts even
 * `import type` edges.
 *
 * Note: there is intentionally no `loading` event. While the puzzle is
 * loading, callers project to `null` (see `usePuzzleDialogEvent`) and the
 * coach renders nothing — staying silent reads as "thinking" and avoids
 * a noisy three-second monologue every time the screen mounts.
 */
export const DIALOG_EVENT = {
  invalid: 'invalid',
  start: 'start',
  progress: 'progress',
  wrong: 'wrong',
  retry: 'retry',
  solved: 'solved',
} as const;

export type DialogEvent = (typeof DIALOG_EVENT)[keyof typeof DIALOG_EVENT];
