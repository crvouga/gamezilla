import { captureVersion, which } from '@pkgs/os';
import type { Dep, DepStatus } from './types';

const INSTALL_HINT =
  'Install Infisical CLI: brew install infisical/get-cli/infisical';

export class InfisicalDep implements Dep {
  readonly name = 'infisical';
  readonly bin = 'infisical';

  version(): string | null {
    return captureVersion('infisical', ['--version']);
  }

  check(): DepStatus {
    if (!which('infisical')) {
      return { ok: false, reason: `not found on PATH — ${INSTALL_HINT}` };
    }
    const v = this.version();
    if (!v) return { ok: false, reason: 'could not determine version' };
    return { ok: true, version: v };
  }

  async fetchLatestVersion(): Promise<string | null> {
    return this.version();
  }

  install(): void {
    throw new Error(INSTALL_HINT);
  }

  upgrade(): void {
    throw new Error(INSTALL_HINT);
  }

  verify(): void {
    if (!which('infisical')) {
      throw new Error(INSTALL_HINT);
    }
  }
}
