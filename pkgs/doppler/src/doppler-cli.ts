import { execSync } from 'node:child_process';

const DOPPLER_TOKEN_ENV_NAME = 'DOPPLER_TOKEN';
const DOPPLER_GET_TOKEN_COMMAND = 'doppler configure get token --plain';

export type DopplerTokenSource = 'env' | 'cli';

export type DopplerTokenResult = {
  token: string;
  source: DopplerTokenSource;
};

export type DopplerCliOptions = {
  tokenEnvName?: string;
  processEnv?: NodeJS.ProcessEnv;
  execSyncFn?: typeof execSync;
};

function createDopplerCliError(message: string, options?: ErrorOptions): Error {
  const error = new Error(message, options);
  error.name = 'DopplerCliError';
  return error;
}

export class DopplerCli {
  private readonly tokenEnvName: string;
  private readonly processEnv: NodeJS.ProcessEnv;
  private readonly execSyncFn: typeof execSync;

  constructor(options?: DopplerCliOptions) {
    const rawName = options?.tokenEnvName ?? DOPPLER_TOKEN_ENV_NAME;
    const tokenEnvName = rawName.trim();
    if (tokenEnvName.length === 0) {
      throw createDopplerCliError('DopplerCli: tokenEnvName must be non-empty');
    }
    this.tokenEnvName = tokenEnvName;
    this.processEnv = options?.processEnv ?? process.env;
    this.execSyncFn = options?.execSyncFn ?? execSync;
  }

  resolveToken(): DopplerTokenResult {
    const fromEnv = this.processEnv[this.tokenEnvName];
    if (typeof fromEnv === 'string') {
      const trimmed = fromEnv.trim();
      if (trimmed.length > 0) {
        return { token: trimmed, source: 'env' };
      }
    }

    let fromCli: string;
    try {
      fromCli = this.execSyncFn(DOPPLER_GET_TOKEN_COMMAND, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch (error: unknown) {
      throw createDopplerCliError(
        `failed to resolve ${this.tokenEnvName} from CLI (\`${DOPPLER_GET_TOKEN_COMMAND}\`)`,
        { cause: error }
      );
    }

    if (fromCli.length === 0) {
      throw createDopplerCliError(
        `${this.tokenEnvName} resolved blank from Doppler CLI output`
      );
    }

    return { token: fromCli, source: 'cli' };
  }

  setSecret(name: string, value: string): void {
    this.execSyncFn(`doppler secrets set ${name}=${value}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  /**
   * Project slug from `doppler configure` (current directory scope). Returns
   * `null` when the CLI is unavailable or no project is configured.
   */
  tryConfigureGetProjectPlain(): string | null {
    try {
      const out = this.execSyncFn('doppler configure get project --plain', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      return out.length > 0 ? out : null;
    } catch {
      return null;
    }
  }

  /**
   * Config name from `doppler configure` (current directory scope). Returns
   * `null` when the CLI is unavailable or no config is configured.
   */
  tryConfigureGetConfigPlain(): string | null {
    try {
      const out = this.execSyncFn('doppler configure get config --plain', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      return out.length > 0 ? out : null;
    } catch {
      return null;
    }
  }
}
