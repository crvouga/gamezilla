/** True when the active secrets scope is production (`SECRETS_ENV=prd`). */
export function isProductionSecretsEnv(): boolean {
  return (process.env['SECRETS_ENV'] ?? '').trim() === 'prd';
}
