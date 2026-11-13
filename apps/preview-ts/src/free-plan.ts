/**
 * What keeps a Preview free. Cloudflare serves static files at no charge at
 * any traffic, so a Preview can only come to cost money two ways: its Worker
 * starts to compute or store something, or a limit of the free plan is met
 * and the plan is upgraded to lift it. Both are refused here, before an
 * upload: a config may declare static files and nothing else, and a bundle
 * must fit the free plan as it is.
 */

import type { PreviewCheck } from './preview-checks';

/** Cloudflare's Workers Free plan, for one assets-only Worker. */
export const FREE_PLAN = {
  previewsPerWorker: 100,
  filesPerUpload: 20_000,
  fileBytes: 25 * 1024 * 1024,
} as const;

/** Everything a static site's Worker declares: where it is and its files. */
const STATIC_KEYS: ReadonlySet<string> = new Set([
  'name',
  'compatibility_date',
  'workers_dev',
  'preview_urls',
  'routes',
  'previews',
  'assets',
]);

/** `binding` and `run_worker_first` hand the files to a Worker script. */
const STATIC_ASSETS_KEYS: ReadonlySet<string> = new Set([
  'directory',
  'html_handling',
  'not_found_handling',
]);

function keysOf(value: unknown): readonly string[] {
  return value !== null && typeof value === 'object' ? Object.keys(value) : [];
}

/**
 * The settings of a wrangler config that are more than static files: a
 * Worker script, a binding, a Durable Object, a schedule, a variable, a
 * limit. An allow-list, so a setting Cloudflare adds later is refused until
 * it is known to be free. Empty for a config that can never be billed.
 */
export function billableSettings(
  config: Readonly<Record<string, unknown>>
): readonly string[] {
  return [
    ...Object.keys(config).filter((key) => !STATIC_KEYS.has(key)),
    ...keysOf(config['assets'])
      .filter((key) => !STATIC_ASSETS_KEYS.has(key))
      .map((key) => `assets.${key}`),
    // A Preview adds nothing to its Worker: no variable, no binding.
    ...keysOf(config['previews']).map((key) => `previews.${key}`),
  ].toSorted();
}

export type BundleFile = {
  readonly path: string;
  readonly bytes: number;
};

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/** Whether a built site fits one upload on the free plan. */
export function freePlanCheck(files: readonly BundleFile[]): PreviewCheck {
  const name = 'free plan';
  const limits = `the free plan allows ${String(FREE_PLAN.filesPerUpload)} files of ${megabytes(FREE_PLAN.fileBytes)} each`;
  if (files.length > FREE_PLAN.filesPerUpload)
    return {
      name,
      ok: false,
      detail: `${String(files.length)} files; ${limits}`,
    };
  const largest = files.reduce<BundleFile | null>(
    (most, file) => (most === null || file.bytes > most.bytes ? file : most),
    null
  );
  if (largest !== null && largest.bytes > FREE_PLAN.fileBytes)
    return {
      name,
      ok: false,
      detail: `${largest.path} is ${megabytes(largest.bytes)}; ${limits}`,
    };
  return {
    name,
    ok: true,
    detail: `${String(files.length)} files, the largest ${megabytes(largest?.bytes ?? 0)}`,
  };
}
