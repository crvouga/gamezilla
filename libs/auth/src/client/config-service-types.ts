/** Resolved API base URL for the mobile client (from env / secret store at build). */
export interface ConfigService {
  getApiUrl(): string;
}
