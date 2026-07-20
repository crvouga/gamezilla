import { createSecretBackendCli } from '@pkgs/secret-provider';
import type { Dep, DepStatus } from './types';

const backend = createSecretBackendCli();

/**
 * Tooling dependency for the configured secrets backend CLI.
 * Concrete binary/install details live in `@pkgs/secret-provider`.
 */
export class SecretBackendDep implements Dep {
  readonly name = backend.name;
  readonly bin = backend.bin;

  version(): string | null {
    return backend.version();
  }

  check(): DepStatus {
    return backend.check();
  }

  async fetchLatestVersion(): Promise<string | null> {
    return backend.fetchLatestVersion();
  }

  install(): void {
    backend.install();
  }

  upgrade(): void {
    backend.upgrade();
  }

  verify(): void {
    backend.verify();
  }
}
