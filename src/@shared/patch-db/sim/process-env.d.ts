declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** When `1` or `true`, sim records events for visualization. */
      PATCHDB_APP?: string;
      /** Override directory for recording JSON (default `.sim-recordings`). */
      PATCHDB_APP_OUT?: string;
    }
  }
}

export {};
