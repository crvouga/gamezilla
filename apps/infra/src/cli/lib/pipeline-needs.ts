/**
 * Shared types for the pipeline report. Lives in its own module so
 * `build-llm-fix-prompt.ts` and `write-pipeline-report.ts` can both import
 * `NeedState` without forming an import cycle (dependency-cruiser counts
 * type-only edges under `tsPreCompilationDeps: true`).
 */
export interface NeedState {
  readonly result: string;
  readonly outputs?: Readonly<Record<string, string>>;
}
