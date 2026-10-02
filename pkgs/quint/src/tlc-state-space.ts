/** Evidence from TLC's completed graph search, rather than a progress update. */
export type TlcStateSpace = { readonly states: number; readonly depth: number };

export function tlcStateSpace(output: string): TlcStateSpace | null {
  if (!output.includes('Model checking completed. No error has been found.'))
    return null;
  const count = [
    ...output.matchAll(
      /([\d,]+) distinct states found, 0 states left on queue\./g
    ),
  ].at(-1)?.[1];
  const depth = /The depth of the complete state graph search is (\d+)\./.exec(
    output
  )?.[1];
  if (count === undefined || depth === undefined) return null;
  const states = Number(count.replaceAll(',', ''));
  return states > 0 ? { states, depth: Number(depth) } : null;
}
