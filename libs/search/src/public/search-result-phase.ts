export type SearchResultPhase =
  | 'needs-connection'
  | 'searching'
  | 'empty'
  | 'results';

/**
 * What people search shows for the current answer.
 * An in-flight search is Searching even when the previous person is still
 * in memory — those rows are not an answer to the username just typed.
 */
export function searchResultPhase(input: {
  readonly searching: boolean;
  readonly needsConnection: boolean;
  readonly resultCount: number;
}): SearchResultPhase {
  if (input.needsConnection) return 'needs-connection';
  if (input.searching) return 'searching';
  if (input.resultCount === 0) return 'empty';
  return 'results';
}

/**
 * A people search has an answer on screen: a painted row, nobody, offline,
 * or sign-in. The list shell is not one — it can mount before a row paints.
 * The spinner is not one either.
 */
export function peopleSearchShowsAnswer(input: {
  readonly loading: boolean;
  readonly empty: boolean;
  readonly needsConnection: boolean;
  readonly denied: boolean;
  readonly paintedRow: boolean;
}): boolean {
  if (input.loading) return false;
  return (
    input.empty || input.needsConnection || input.denied || input.paintedRow
  );
}
