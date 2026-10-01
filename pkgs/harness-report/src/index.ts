/**
 * The shared reports store: its key layout, the wire protocol a reports API
 * speaks, and the read side it serves. Worker-safe (no DOM, no runtime I/O).
 * CI's write side is `@pkgs/harness-report/remote/publish`; the browser
 * screen is `@pkgs/harness-report/client`.
 */
export * from './remote/keys';
export * from './remote/protocol';
export {
  type CommitEventsOptions,
  commitEvents,
  type FrameBody,
  listCommits,
  listSourceRecords,
  readCommit,
  readFrameBody,
  readTestReport,
  testEvents,
} from './remote/read';
