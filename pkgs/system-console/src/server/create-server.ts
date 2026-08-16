import {
  type CreateSystemConsoleAppOptions,
  createSystemConsoleApp,
} from './create-system-console-app';

export type { ReportBucket } from './types';

export type CreateSimulationReportServerOptions = CreateSystemConsoleAppOptions;

export type SimulationReportServer = {
  readonly fetch: (req: Request) => Promise<Response>;
  readonly stop: () => void;
};

/**
 * Fetch-handler wrapper around {@link createSystemConsoleApp} for tests
 * and non-Hono hosts.
 */
export function createSimulationReportServer(
  options: CreateSimulationReportServerOptions
): SimulationReportServer {
  const { app, stop } = createSystemConsoleApp(options);
  return {
    fetch: async (req) => app.fetch(req),
    stop,
  };
}
