import {
  type CreateSimConsoleAppOptions,
  createSimConsoleApp,
} from './create-sim-console-app';

export type { ReportBucket } from './types';

export type CreateSimulationReportServerOptions = CreateSimConsoleAppOptions;

export type SimulationReportServer = {
  readonly fetch: (req: Request) => Promise<Response>;
  readonly stop: () => void;
};

/**
 * Fetch-handler wrapper around {@link createSimConsoleApp} for tests
 * and non-Hono hosts.
 */
export function createSimulationReportServer(
  options: CreateSimulationReportServerOptions
): SimulationReportServer {
  const { app, stop } = createSimConsoleApp(options);
  return {
    fetch: async (req) => app.fetch(req),
    stop,
  };
}
