import { captureVersion, which } from '@pkgs/os';
import type { Dep, DepStatus } from './types';

const INSTALL_HINT =
  'Install the Vault CLI wrapper from the secret-store repo: ./scripts/install-cli.sh';

export class VaultDep implements Dep {
  readonly name = 'vault';
  readonly bin = 'vault';

  version(): string | null {
    return captureVersion('vault', ['--version']);
  }

  check(): DepStatus {
    if (!which('vault')) {
      return { ok: false, reason: `not found on PATH — ${INSTALL_HINT}` };
    }
    if (!which('bao')) {
      return {
        ok: false,
        reason: `OpenBao binary (bao) not found on PATH — ${INSTALL_HINT}`,
      };
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
    if (!which('vault') || !which('bao')) {
      throw new Error(INSTALL_HINT);
    }
  }
}
