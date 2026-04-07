export interface SecretEntry {
  readonly doppler: string;
  readonly env: string;
  readonly hint: string;
  validate(value: string): Promise<string | null>;
}

export async function validateSecret(
  entry: SecretEntry,
  value: string,
): Promise<string | null> {
  return entry.validate(value);
}
