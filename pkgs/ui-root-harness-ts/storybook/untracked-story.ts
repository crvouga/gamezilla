import { untrack } from 'solid-js';

/**
 * Run a decorated story without subscribing whoever calls it.
 *
 * The renderer mounts a story once and, on every later args or globals
 * update, calls it again only to let hook-style decorators (backgrounds,
 * measure, outline) react: that later call returns nothing by design. It
 * also holds the story in a memo, so a decorator reading a global inside
 * the story would re-run that memo on the global's change and replace the
 * mounted story with the nothing a later call returns. A story is rendered
 * by being mounted, never by being re-run.
 */
export function untrackedStory<Context, Result>(
  story: (context: Context) => Result
): (context: Context) => Result {
  return (context) => untrack(() => story(context));
}
