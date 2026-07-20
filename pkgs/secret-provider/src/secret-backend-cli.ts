import { InfisicalCliDep } from './impl-infisical/cli-dep';
import { INFISICAL_DEFAULT_ENDPOINT } from './impl-infisical/defaults';

export type SecretBackendCliStatus =
  | { readonly ok: true; readonly version: string }
  | { readonly ok: false; readonly reason: string };

export type SecretBackendCli = {
  readonly name: string;
  readonly bin: string;
  version(): string | null;
  check(): SecretBackendCliStatus;
  fetchLatestVersion(): Promise<string | null>;
  install(): void;
  upgrade(): void;
  verify(): void;
};

/** CLI dependency for the configured secrets backend (install / check / upgrade). */
export function createSecretBackendCli(): SecretBackendCli {
  return new InfisicalCliDep();
}

/** Dashboard URL for the configured secrets backend (vendor console links). */
export function getSecretsDashboardUrl(): string {
  return INFISICAL_DEFAULT_ENDPOINT;
}
