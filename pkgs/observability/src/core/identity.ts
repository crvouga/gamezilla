import type { Span } from '@opentelemetry/api';

import { ATTR } from './attributes';

export type ObservabilityIdentity = {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly deviceId?: string;
  readonly buildSha?: string;
};

export type IdentitySource = () => ObservabilityIdentity;

export function stampIdentity(
  span: Span,
  identity: ObservabilityIdentity
): void {
  if (identity.userId !== undefined) {
    span.setAttribute(ATTR.USER_ID, identity.userId);
  }
  if (identity.sessionId !== undefined) {
    span.setAttribute(ATTR.SESSION_ID, identity.sessionId);
  }
  if (identity.deviceId !== undefined) {
    span.setAttribute(ATTR.APP_DEVICE_ID, identity.deviceId);
  }
  if (identity.buildSha !== undefined) {
    span.setAttribute(ATTR.APP_BUILD_SHA, identity.buildSha);
  }
}
