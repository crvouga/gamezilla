import type { ObservabilityIdentity } from '@pkgs/observability/core';

let identity: ObservabilityIdentity = {};
let recentTraceId: string | undefined;

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
      `obs find ${sessionId} --source prod`,
    ].join('\n');
  };
}
