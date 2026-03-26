declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** When `1` or `true`, sim records events for visualization. */
      SIM_VIZ?: string;
      /** Override directory for recording JSON (default `.sim-recordings`). */
      SIM_VIZ_OUT?: string;
    }
  }
}

export {};
