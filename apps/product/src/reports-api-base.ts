import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/app-config-shared/local-preview-api-origin';

/**
 * Where the reports screen reads `/api/reports`.
 *
 * The localhost stack points the client at its own API. A Vite dev server
 * whose API is still the wrangler preview origin (`localhost:8788`) serves
 * `/api/reports` on the page origin instead, because that command does not
 * start wrangler. Any other configured API stays the source.
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
