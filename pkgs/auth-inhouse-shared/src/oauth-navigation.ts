/** A browser hop, including a document handoff that starts a fresh GET. */
export type OauthNavigation = {
  readonly url: URL;
  readonly preserveMethod: boolean;
};

/** Follow redirects and the immediate HTML refresh used by OAuth callbacks. */
export function oauthNavigation(
  response: Response,
  requestUrl: string
): OauthNavigation | null {
  const location = response.headers.get('location');
  if (response.status >= 300 && response.status < 400 && location !== null)
    return {
      url: new URL(location, requestUrl),
      preserveMethod: response.status === 307 || response.status === 308,
    };
  if (
    !response.ok ||
    !response.headers.get('content-type')?.includes('text/html')
  )
    return null;
  const refresh = /^0\s*;\s*url=(.+)$/i.exec(
    response.headers.get('refresh') ?? ''
  );
  if (refresh?.[1] === undefined) return null;
  return { url: new URL(refresh[1], requestUrl), preserveMethod: false };
}
