import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/public/local-preview-api-origin';

/**
 * Where the reports screen reads `/api/reports`.
 *
 * `bun dev` is the Vite app alone. Its client is pointed at wrangler on
 * `localhost:8788`, which that command does not start, so the screen would
 * have no API. On that loopback dev server the page origin serves the reports
 * API itself. A configured API that is not the default wrangler preview
 * (the localhost stack, a deployed API) stays the source.
 */
export function reportsApiBase(args: {
  readonly dev: boolean;
  readonly pageOrigin: string;
  readonly configuredApi: string;
}): string {
  if (!args.dev) return args.configuredApi;
  if (args.configuredApi !== DEFAULT_LOCAL_PREVIEW_API_ORIGIN) {
    return args.configuredApi;
  }
  try {
    const page = new URL(args.pageOrigin);
    if (!isLoopback(page.hostname)) return args.configuredApi;
    return page.origin;
  } catch {
    return args.configuredApi;
  }
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  );
}
