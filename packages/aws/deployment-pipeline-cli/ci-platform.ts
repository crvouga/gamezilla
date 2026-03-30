export interface CiPlatform {
  error(message: string): void;
  notice(message: string): void;
  /** Whether the pipeline should enforce that the OIDC deploy role was assumed. */
  readonly enforceDeployRole: boolean;
  /** Append markdown to the CI job summary. No-op when unsupported. */
  appendJobSummary(markdown: string): void;
}
