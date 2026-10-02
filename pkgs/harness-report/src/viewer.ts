/** The viewer's navigation and presentation decisions for embedded hosts. */

export { type KeyNavHandlers, onReportKeyDown } from './app/keyboard';
export * from './lib/catalog';
export * from './lib/frames';
export * from './lib/hash';
export { stateFrameHtml } from './lib/html-frame';
export {
  createSnapshotHost,
  type HitResult,
  paintSnapshotHost,
} from './lib/snapshot-surface';
export { testCatalogEntity } from './lib/test-catalog-entity';
export {
  createHttpReportFetcher,
  memoryReportCache,
  reportQueryClient,
} from './remote/fetcher';
export { createRemoteReport, type RemoteReport } from './remote/remote-report';
