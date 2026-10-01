import {
  defineAction,
  defineRuntime,
  defineSystem,
  type Session,
  virtualTimeRuntime,
} from '@pkgs/harness';
import {
  createExampleApp,
  type DiagnosticsCondition,
  type ProductCondition,
} from './example-app';

export interface BugReportingWorld {
  readonly session: Session;
  readonly app: ReturnType<typeof createExampleApp>;
}
export const productCondition = defineAction({
  name: 'productCondition',
  act: (world: BugReportingWorld, condition: ProductCondition) =>
    world.app.boot(condition),
});
export const diagnosticsCondition = defineAction({
  name: 'diagnosticsCondition',
  act: (world: BugReportingWorld, condition: DiagnosticsCondition) =>
    world.app.setDiagnostics(condition),
});
export const submitReport = defineAction({
  name: 'submitReport',
  act: (
    world: BugReportingWorld,
    input: { title: string; description: string }
  ) => world.app.submit(input.title, input.description),
});
export const closeProduct = defineAction({
  name: 'closeProduct',
  act: (world: BugReportingWorld) => world.app.close(),
});
export const readReport = (world: BugReportingWorld) => world.app.report();
export const bugReportingSystem = defineSystem<BugReportingWorld>({
  name: 'bug-reporting',
  create(session) {
    const app = createExampleApp(session);
    app.boot();
    session.onDispose(() => app.close());
    return { session, app };
  },
  runtimes: [
    defineRuntime({
      name: 'virtual',
      default: true,
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [productCondition, diagnosticsCondition, submitReport, closeProduct],
});
