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

export function browserObservabilityIdentity(): ObservabilityIdentity {
  return identity;
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
