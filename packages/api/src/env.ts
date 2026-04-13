export interface Env {
  DATABASE_URL: string;
  /** Optional: Google Web client ID for verifying id_token `aud`. */
  GOOGLE_CLIENT_ID?: string;
}
