import type { HostedAuthUiPort } from '../ports';

export class HostedAuthUiClerkAdapter implements HostedAuthUiPort {
  readonly available = true;
  readonly unavailableReason = null;
}

