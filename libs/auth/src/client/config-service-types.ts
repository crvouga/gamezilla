/** Resolved API base URL for the mobile client (from env / Vault at build). */
export interface ConfigService {
  getApiUrl(): string;
}
