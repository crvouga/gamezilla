import type { Session } from '@pkgs/harness';
import { readBytes } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { HttpIssueReporter } from '../client/http-issue-reporter';
import { mountRootReporting } from '../client/mount-root-reporting';
import { startRootRuntime } from '../client/root-runtime';
import { FileSystemIssueReporter } from '../server/filesystem-issue-reporter';
import { createBugReportHandler } from '../server/http-handler';
import type { BugReport, DiagnosticProvider } from '../shared/types';

export type ProductCondition =
  | 'working'
  | 'loading'
  | 'crashed'
  | 'router'
  | 'auth'
  | 'offline';
export type DiagnosticsCondition = 'available' | 'throws' | 'hangs';

export function createExampleApp(session: Session) {
  const store = new ObjectStoreImplInMemory();
  let dispose: (() => void) | null = null;
  let host: HTMLElement | null = null;
  let lastReportId = '';
  let diagnosticsCondition: DiagnosticsCondition = 'available';
  const providers: DiagnosticProvider[] = [
    'context',
    'screenshot',
    'telemetry',
  ].map((name) => ({
    name,
    collect() {
      if (diagnosticsCondition === 'throws') throw new Error('Unavailable');
      if (diagnosticsCondition === 'hangs') return new Promise(() => {});
      return { captured: true };
    },
  }));
  const server = createBugReportHandler({
    reporter: new FileSystemIssueReporter(store),
    clock: session.ports.clock,
    allowedOrigin: 'http://local',
  });
  const reporter = new HttpIssueReporter({
    endpoint: 'http://local/api/bug-reports',
    timers: session.ports.timers,
    http: {
      async fetch(input, init) {
        const request = new Request(input, init);
        const body = (await request.clone().json()) as BugReport;
        lastReportId = body.id;
        return server(request);
      },
    },
  });
  return {
    store,
    boot(condition: ProductCondition = 'working'): void {
      dispose?.();
      host = document.createElement('aside');
      document.body.append(host);
      const mountedHost = host;
      startRootRuntime({
        installReporting(diagnostics) {
          const root = mountRootReporting({
            window,
            document,
            host: mountedHost,
            diagnostics,
            reporter,
            providers,
            clock: session.ports.clock,
            timers: session.ports.timers,
            createId: session.ports.createId,
          });
          dispose = root.dispose;
        },
        startProduct() {
          if (condition === 'loading') return new Promise(() => {});
          if (['crashed', 'router', 'auth'].includes(condition))
            throw new Error(condition);
          return Promise.resolve();
        },
      });
    },
    setDiagnostics(condition: DiagnosticsCondition): void {
      diagnosticsCondition = condition;
    },
    async submit(title: string, description: string): Promise<void> {
      const shadow = host?.shadowRoot;
      if (!shadow) throw new Error('Reporting not mounted');
      const titleInput = shadow.querySelector<HTMLInputElement>('input');
      const descriptionInput = shadow.querySelector<HTMLTextAreaElement>(
        '[name="description"]'
      );
      const form = shadow.querySelector('form');
      if (!titleInput || !descriptionInput || !form)
        throw new Error('Reporting unavailable');
      titleInput.value = title;
      descriptionInput.value = description;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await session.waitForIdle();
      await session.advanceTime(500);
      await session.waitForIdle();
    },
    async report(): Promise<BugReport | null> {
      const value = await store.get(`bug-${lastReportId}/report.json`);
      return value
        ? (JSON.parse(
            new TextDecoder().decode(await readBytes(value.body))
          ) as BugReport)
        : null;
    },
    close(): void {
      dispose?.();
      dispose = null;
      host = null;
    },
  };
}
