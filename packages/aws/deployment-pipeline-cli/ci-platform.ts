import assert from 'node:assert/strict';

export interface CiPlatform {
  error(message: string): void;
  notice(message: string): void;
  /** Whether the pipeline should enforce that the OIDC deploy role was assumed. */
  readonly enforceDeployRole: boolean;
  /** Append markdown to the CI job summary. No-op when unsupported. */
  appendJobSummary(markdown: string): void;
}
let platform: CiPlatform | undefined;

export function setCiPlatform(p: CiPlatform): void {
  assert(p !== null && p !== undefined);
  platform = p;
}

export function getCiPlatform(): CiPlatform {
  assert(
    platform !== undefined,
    'getCiPlatform: platform not initialized — call setCiPlatform() first'
  );
  return platform;
}

export function reportError(message: string): void {
  assert(typeof message === 'string' && message.length > 0);
  getCiPlatform().error(message);
}

export function reportNotice(message: string): void {
  assert(typeof message === 'string' && message.length > 0);
  getCiPlatform().notice(message);
}
