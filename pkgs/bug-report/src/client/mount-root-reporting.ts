import type { Clock, Timers } from '@pkgs/clock';
import type { CreateId } from '@pkgs/uuid';
import { createBugReporting } from '../shared/reporting';
import type {
  BugReport,
  DiagnosticProvider,
  IssueReporter,
} from '../shared/types';
import { installCrashHandlers } from './crash-handlers';
import { createReportingSurface } from './reporting-surface';
import type { createRootDiagnostics } from './root-diagnostics';

export interface ReportingDraftStore {
  save(value: string): void;
  load(): string | null;
  clear(): void;
}

/** Separate DOM root, listeners and ports. No router, auth, store, theme or provider. */
export function mountRootReporting(options: {
  readonly window: Window;
  readonly document: Document;
  readonly host: HTMLElement;
  readonly reporter: IssueReporter;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly diagnostics: ReturnType<typeof createRootDiagnostics>;
  readonly draft?: ReportingDraftStore;
  readonly providers?: readonly DiagnosticProvider[];
}) {
  const surface = createReportingSurface(options.host);
  let attempted: BugReport | null = null;
  const reporting = createBugReporting({
    ...options,
    reporter: {
      create(report) {
        attempted = report;
        try {
          options.draft?.save(JSON.stringify(report));
        } catch {
          /* optional persistence */
        }
        return options.reporter.create(report);
      },
    },
    providers: [options.diagnostics.provider, ...(options.providers ?? [])],
  });
  const removeCrashHandlers = installCrashHandlers(
    options.window,
    options.diagnostics,
    surface.open
  );
  try {
    const saved = options.draft?.load();
    if (saved) {
      const report = JSON.parse(saved) as BugReport;
      surface.title.value = report.title;
      surface.description.value = report.description;
    }
  } catch {
    /* draft recovery is optional */
  }
  const saveDraft = () => {
    try {
      options.draft?.save(
        JSON.stringify({
          title: surface.title.value,
          description: surface.description.value,
        })
      );
    } catch {
      /* storage denial cannot disable submission */
    }
  };
  surface.form.addEventListener('input', saveDraft);
  surface.form.addEventListener('submit', (event) => {
    event.preventDefault();
    surface.pending();
    saveDraft();
    void reporting
      .submit({
        title: surface.title.value,
        description: surface.description.value,
      })
      .then(
        (saved) => {
          surface.saved(saved.issue);
          try {
            options.draft?.clear();
          } catch {
            /* optional draft cleanup */
          }
        },
        () =>
          surface.failed(
            attempted ?? {
              version: 1,
              id: 'emergency',
              createdAt: 'unknown',
              status: 'open',
              title: surface.title.value || 'Emergency bug report',
              description: surface.description.value,
              diagnostics: [],
            }
          )
      );
  });
  return {
    open: surface.open,
    dispose(): void {
      removeCrashHandlers();
      options.host.remove();
    },
  };
}
