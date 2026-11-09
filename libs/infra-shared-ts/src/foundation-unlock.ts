import { envFile } from './envs';
import type { TofuPaths } from './tofu-command';
import { tofuCredentialEnvironment } from './tofu-command';

/**
 * State-backend credentials only: `force-unlock` never talks to cloud
 * providers. Empty provider TF_VARs satisfy the foundation schema.
 */
export function foundationUnlockEnvironment(
  secrets: Readonly<Record<string, string | undefined>>,
  paths: TofuPaths,
  envName: string
) {
  envFile(envName);
  const target = { stack: 'foundation' as const, env: envName };
  const result = tofuCredentialEnvironment(secrets, paths, target, {
    TF_VAR_state_passphrase: 'TOFU_STATE_PASSPHRASE',
    AWS_ACCESS_KEY_ID: 'TOFU_STATE_ACCESS_KEY_ID',
    AWS_SECRET_ACCESS_KEY: 'TOFU_STATE_SECRET_ACCESS_KEY',
  });
  result.env['TF_VAR_infisical_token'] = '';
  result.env['TF_VAR_aws_access_key_id'] = '';
  result.env['TF_VAR_aws_secret_access_key'] = '';
  result.env['TF_VAR_aws_session_token'] = '';
  return result;
}
