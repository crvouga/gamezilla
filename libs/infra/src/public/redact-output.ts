/** Keep diagnostics and resource addresses, excluding configured credentials and credential fields. */
export function redactInfraOutput(
  output: string,
  env: Readonly<Record<string, string | undefined>>
): string {
  const secrets = Object.entries(env)
    .filter(
      ([key, value]) =>
        /TOKEN|SECRET|PASSWORD|PASSPHRASE|ACCESS_KEY|PRIVATE_KEY/i.test(key) &&
        value &&
        value.length >= 4
    )
    .map(([, value]) => value!)
    .sort((a, b) => b.length - a.length);
  let safe = output;
  for (const secret of secrets) safe = safe.replaceAll(secret, '[redacted]');
  return safe
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[redacted]')
    .replace(
      /((?:access_key_id|secret_access_key|session_token|token|password|passphrase)\s*=\s*)"[^"\r\n]*"/gi,
      '$1"[redacted]"'
    );
}
