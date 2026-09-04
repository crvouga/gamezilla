/**
 * `local-file` observability backend: spans POST to a local collector process
 * which appends them to NDJSON on disk.
 *
 * Only this entrypoint is safe to bundle into a client — the collector, file
 * sink, and summarize CLI are node-only and stay behind deep imports
 * (`@pkgs/observability-impl-local-file/collector`, `/summarize-cli`).
 */

export {
  createLocalFileObservability,
  createLocalFileObservabilityWithExporter,
  type LocalFileObservabilityOptions,
} from './create-local-file-observability';
