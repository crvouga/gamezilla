export interface SecretEntry {
  readonly secretKey: string;
  readonly env: string;
  readonly hint: string;
  /**
   * When true, missing values in Doppler are not warnings or errors — the
   * code that consumes the env var must handle absence gracefully (typically
   * via {@link SecretStore.getOptional}).
   */
  readonly optional?: boolean;
  validate(value: string): Promise<string | null>;
}

export async function validateSecret(
  entry: SecretEntry,
  value: string
): Promise<string | null> {
  return entry.validate(value);
}
