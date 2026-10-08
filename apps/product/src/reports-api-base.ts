/**
 * Where the reports screen reads `/api/reports`.
 *
 * Local stacks and Vite use the page's reports middleware, which provides
 * committed specs and local evidence alongside the shared store. Remote API
 * configurations keep their configured origin.
 */
export function reportsApiBase(args: {
  readonly dev: boolean;
  readonly pageOrigin: string;
  readonly configuredApi: string;
}): string {
  if (!args.dev) return args.configuredApi;
  try {
    const page = new URL(args.pageOrigin);
    if (!isLoopback(page.hostname)) return args.configuredApi;
    if (!isLoopback(new URL(args.configuredApi).hostname))
      return args.configuredApi;
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
