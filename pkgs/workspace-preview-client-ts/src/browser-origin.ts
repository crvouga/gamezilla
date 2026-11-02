/** Preview selection is explicit and restricted to development bundles. */
export function resolveBrowserPreviewOrigin(args: {
  readonly development: boolean;
  readonly enabled: boolean;
  readonly origin: string | undefined;
}): string | null {
  if (!args.development || !args.enabled) return null;
  if (args.origin === undefined)
    throw new Error('Same-origin preview requires a browser origin');
  const url = new URL(args.origin);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Preview requires an HTTP browser origin');
  return url.origin;
}

/** Production bundles always retain their configured API boundary. */
export function browserPreviewOrigin(): string | null {
  const env = import.meta.env as {
    DEV?: boolean;
    VITE_LOCAL_PREVIEW_SAME_ORIGIN?: string;
  };
  return resolveBrowserPreviewOrigin({
    development: env.DEV === true,
    enabled: env.VITE_LOCAL_PREVIEW_SAME_ORIGIN === '1',
    origin: typeof window === 'undefined' ? undefined : window.location.origin,
  });
}
