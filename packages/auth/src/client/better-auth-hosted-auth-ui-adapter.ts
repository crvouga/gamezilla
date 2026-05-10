import type { HostedAuthUiPort } from './ports';

export class HostedAuthUiBetterAuthAdapter implements HostedAuthUiPort {
  readonly available = true;
  readonly unavailableReason: string | null = null;
}
