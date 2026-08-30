const REPORTS_PATH = '/reports';

/** Pure — Metro origin on native so `public/reports` is reachable from Expo Go. */
export function reportsPublicBaseUrlFromHost(args: {
  readonly platformOs: string;
  readonly hostUri: string | undefined;
}): string {
  if (args.platformOs === 'web') return REPORTS_PATH;
  const host = args.hostUri?.trim();
  if (host !== undefined && host.length > 0) {
    return `http://${host}${REPORTS_PATH}`;
  }
  return REPORTS_PATH;
}
