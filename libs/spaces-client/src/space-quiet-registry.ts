/** In-process marks, one per room client. The harness calls the same function the timer does. */
const marks = new Map<string, (quiet: boolean) => void>();
/** Clients whose own timer has marked them quiet. A later clock must not clear these. */
const notedQuiet = new Set<string>();

/** Remember the mark this device just sent, so another device's clock can leave it alone. */
export function noteSpaceQuiet(clientId: string, quiet: boolean): void {
  if (quiet) notedQuiet.add(clientId);
  else notedQuiet.delete(clientId);
}

/** True after this device marked itself quiet and has not cleared that mark. */
export function spaceClientIsQuiet(clientId: string): boolean {
  return notedQuiet.has(clientId);
}

export function registerSpaceQuiet(
  clientId: string,
  mark: (quiet: boolean) => void
): () => void {
  marks.set(clientId, mark);
  return () => {
    if (marks.get(clientId) === mark) marks.delete(clientId);
  };
}

export function markSpaceQuiet(clientId: string, quiet: boolean): void {
  const mark = marks.get(clientId);
  if (mark !== undefined) mark(quiet);
}
