import { recordFeedbackTrace } from '@pkgs/feedback-shared-ts/context';
import type { ObservabilityIdentity } from '@pkgs/observability-root-shared-ts/identity';

let identity: ObservabilityIdentity = {};
let recentTraceId: string | undefined;

export const BROWSER_STARTUP_STAGES = [
  'client.boot.pool',
  'client.boot.registry',
  'client.boot.app',
  'client.boot.lease',
  'db.connect',
  'db.migrate',
  'client.boot.config',
  'client.sync.connect',
] as const;
export type BrowserStartupStage = (typeof BROWSER_STARTUP_STAGES)[number];

const pendingStartup = new Map<BrowserStartupStage, number>();

/** Pending work survives in diagnostics even when its span never finishes. */
export async function trackBrowserStartup<T>(
  stage: BrowserStartupStage,
  work: () => Promise<T>
): Promise<T> {
  pendingStartup.set(stage, (pendingStartup.get(stage) ?? 0) + 1);
  try {
    return await work();
  } finally {
    const remaining = (pendingStartup.get(stage) ?? 1) - 1;
    if (remaining === 0) pendingStartup.delete(stage);
    else pendingStartup.set(stage, remaining);
  }
}

export function pendingBrowserStartup(): readonly BrowserStartupStage[] {
  return [...pendingStartup.keys()];
}

export function setBrowserSessionId(sessionId: string): void {
  identity = { ...identity, sessionId };
}

export function setBrowserLocalIdentity(
  userId: string | null,
  deviceId: string | null
): void {
  identity = {
    ...(identity.sessionId === undefined
      ? {}
      : { sessionId: identity.sessionId }),
    ...(identity.buildSha === undefined ? {} : { buildSha: identity.buildSha }),
    ...(userId === null ? {} : { userId }),
    ...(deviceId === null ? {} : { deviceId }),
  };
}

function deviceTimeZone(): string | undefined {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return typeof zone === 'string' && zone.length > 0 ? zone : undefined;
}

export function browserObservabilityIdentity(): ObservabilityIdentity {
  const zone = deviceTimeZone();
  return zone === undefined ? identity : { ...identity, deviceTimeZone: zone };
}

export function recordRecentTraceId(traceId: string): void {
  recentTraceId = traceId;
  recordFeedbackTrace(traceId);
}

export function installBrowserObsHelper(): void {
  const host = window as unknown as { __obs?: () => string };
  host.__obs = () => {
    const traceId = recentTraceId ?? 'unavailable';
    const sessionId = identity.sessionId ?? 'unavailable';
    return [
      `user.id=${identity.userId ?? 'unavailable'}`,
      `session.id=${sessionId}`,
      `app.device.id=${identity.deviceId ?? 'unavailable'}`,
      `trace.id=${traceId}`,
      `startup.pending=${pendingBrowserStartup().join(',')}`,
      `obs find ${sessionId} --source prod`,
    ].join('\n');
  };
}
