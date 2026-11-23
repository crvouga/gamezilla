/**
 * What `bun run dev` prints: where the app is, where Storybook is, and the one
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

export function devLine(label: string, value: string): string {
  return `${label.padEnd(11)}${value}\n`;
}
