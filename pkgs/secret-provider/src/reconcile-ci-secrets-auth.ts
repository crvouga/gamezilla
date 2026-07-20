import {
  reconcileInfisicalCiSecretsAuth,
  SECRETS_IDENTITY_ID_VAR,
  SECRETS_PROJECT_ID_VAR,
  type ReconcileInfisicalCiSecretsAuthOptions,
} from './impl-infisical/ci-reconcile';

export type ReconcileCiSecretsAuthOptions =
  ReconcileInfisicalCiSecretsAuthOptions;

export {
  SECRETS_IDENTITY_ID_VAR,
  SECRETS_PROJECT_ID_VAR,
};

/**
 * Ensure CI can authenticate to the secrets backend via GitHub OIDC and that
 * provider-neutral repository variables are set.
 */
export async function reconcileCiSecretsAuth(
  options: ReconcileCiSecretsAuthOptions
): Promise<void> {
  return reconcileInfisicalCiSecretsAuth(options);
}
