/**
 * A Worker's `compatibility_date` must not be newer than the date the pinned
 * workerd supports. Release boots the Worker under the local workerd
 * (`verify:api` → `preview:serve`), which refuses a newer date, while
 * `wrangler deploy --dry-run` only bundles and never notices — so the date
 * once ran ahead of the pinned wrangler and every release failed with the gate
 * green. `verify:worker-bundle` runs this verification before it bundles.
 */

const COMPAT_DATE_LINE = /^compatibility_date\s*=\s*"(\d{4}-\d{2}-\d{2})"/m;
const WORKERD_DATE = /compatibilityDate\s*=\s*"(\d{4}-\d{2}-\d{2})"/;

/** The top-level `compatibility_date` in a `wrangler.toml` body. */
export function readCompatibilityDate(wranglerToml: string): string | null {
  return COMPAT_DATE_LINE.exec(wranglerToml)?.[1] ?? null;
}

/** The `compatibilityDate` workerd's `lib/main.js` advertises. */
export function readWorkerdSupportedDate(workerdMain: string): string | null {
  return WORKERD_DATE.exec(workerdMain)?.[1] ?? null;
}

/** An error message when `configured` is ahead of `supported`, else null. */
export function compatibilityDateProblem(
  configured: string,
  supported: string
): string | null {
  // ISO dates compare correctly as strings.
  if (configured <= supported) return null;
  return `compatibility_date "${configured}" is newer than "${supported}", the newest date the pinned workerd supports — bump wrangler in the root catalog or lower the date`;
}
