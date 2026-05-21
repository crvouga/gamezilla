import { DopplerCli } from '@pkgs/doppler/doppler-cli';
import { DopplerScriptSecretStore } from './doppler-script-secret-store';
import { DopplerSecretStore } from './doppler-secret-store';
import type { SecretStore } from './interface';

function trimOpt(value: string | undefined): string | null {
  if (value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/**
 * {@link SecretStore} for Node/Bun scripts (setup, migrations, deploy).
 * Reads via Doppler's HTTP `secrets/download` endpoint and writes via the local
 * Doppler CLI (`doppler secrets set`) — both transports converge on the same
 * project/config.
 *
 * Fills `project` / `config` from `DOPPLER_PROJECT` / `DOPPLER_CONFIG` or from
 * `doppler configure get … --plain` so personal CLI tokens work with the
 * secrets download API. Workers should use `new DopplerSecretStore({ token })`
 * with a config-scoped service token (no project/config query params, no CLI).
 */
export function createDopplerSecretStoreForScripts(): SecretStore {
  const cli = new DopplerCli();
  const { token } = cli.resolveToken();
  const envProject =
    typeof process !== 'undefined'
      ? trimOpt(process.env['DOPPLER_PROJECT'])
      : null;
  const envConfig =
    typeof process !== 'undefined'
      ? trimOpt(process.env['DOPPLER_CONFIG'])
      : null;
  const project = envProject ?? cli.tryConfigureGetProjectPlain();
  const config = envConfig ?? cli.tryConfigureGetConfigPlain();
  const reader = new DopplerSecretStore({
    token,
    ...(project !== null ? { project } : {}),
    ...(config !== null ? { config } : {}),
  });
  return new DopplerScriptSecretStore(reader, cli);
}
