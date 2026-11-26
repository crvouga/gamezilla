import { pathToFileURL } from 'node:url';

/**
 * What `bun run dev` prints: the product app, Storybook and the one
 * file every process of the stack logs to. Each address comes from the record
 * its own process publishes once it can serve.
 */

export function devLogPath(stackRootDir: string): string {
  return `${stackRootDir}/dev.log`;
}

/** The app's address, once a boot no older than `sinceMs` has published it. */
export function appLink(
  manifest: {
    readonly webOrigin?: string | null;
    readonly startedAtMs?: number;
  } | null,
  sinceMs: number
): string | null {
  if (!manifest?.webOrigin || (manifest.startedAtMs ?? 0) < sinceMs)
    return null;
  return `${manifest.webOrigin}/`;
}

/** Storybook's address, once its live launcher reports it ready. */
export function storybookLink(
  record: {
    readonly status?: string;
    readonly pid?: number;
    readonly localUrl?: string;
  } | null,
  alive: (pid: number) => boolean
): string | null {
  if (record?.status !== 'ready' || !record.localUrl) return null;
  if (record.pid === undefined || !alive(record.pid)) return null;
  return `${record.localUrl}/`;
}

/** OSC 8 labels keep the interactive row short. Pipes retain copyable URLs. */
export function devStatusLine(args: {
  status: string;
  logPath: string;
  storybook: string | null;
  product: string | null;
  terminal: boolean;
}): string {
  function link(label: string, url: string): string {
    return args.terminal
      ? `\x1b]8;;${url}\x1b\\${label}\x1b]8;;\x1b\\`
      : `${label} ${url}`;
  }
  return [
    args.status,
    link('Logs', pathToFileURL(args.logPath).href),
    args.storybook && link('Storybook', args.storybook),
    args.product && link('Product', args.product),
  ]
    .filter(Boolean)
    .join(' · ');
}
