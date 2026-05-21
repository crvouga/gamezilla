/** Resolved API base URL for the mobile client (from env / Doppler at build). */
export interface ConfigService {
  getApiUrl(): string;
}
