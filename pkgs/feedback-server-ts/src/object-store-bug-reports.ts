import type { Clock } from '@pkgs/clock-shared-ts/types';
import type {
  BugReportAttachments,
  BugReportRecords,
  BugReportStore,
  ReceivedBugReport,
} from '@pkgs/feedback-shared-ts/types';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { bugReportIssue } from './issue-body';

const JSON_TYPE = 'application/json';
/** Where nothing is ever written: asked for only to prove the store answers. */
const PROBE_KEY = 'health/probe';

/** A bug report's files, each under `reports/<id>/`, as `bun feedback` reads them. */
export function objectStoreBugReportAttachments(
  store: ObjectStore
): BugReportAttachments {
  return {
    put: (id, name, bytes, contentType) =>
      store.put(`reports/${id}/${name}`, bytes, contentType),
    get: (id, name) => store.get(`reports/${id}/${name}`),
    async check() {
      await store.head(PROBE_KEY);
    },
  };
}

/** Where the bug reports taken from one device on one day (`2026-03-02`, UTC) are counted. */
function takenFromDevice(day: string, reporterId: string): string {
  return `limits/${day}/reporters/${reporterId}/`;
}

/**
 * Bug reports recorded in an object store: the `.feedback/` folder in
 * development, and memory in tests. The readable report beside each one
 * stands in for the issue.
 */
export function objectStoreBugReportRecords(
  store: ObjectStore,
  clock: Clock
): BugReportRecords {
  return {
    async find(id) {
      const receipt = await readUtf8(store, `reports/${id}/receipt.json`);
      return receipt === null
        ? null
        : (JSON.parse(receipt) as ReceivedBugReport);
    },
    async countOnDay(day, reporterId) {
      return {
        fromDevice: (await store.listKeys(takenFromDevice(day, reporterId)))
          .length,
        total: (await store.listKeys(`limits/${day}/all/`)).length,
      };
    },
    async record(report) {
      const folder = `reports/${report.id}`;
      const issue = { id: report.id, location: `${folder}/report.md` };
      await writeUtf8(
        store,
        `${folder}/report.md`,
        bugReportIssue(report).body,
        'text/markdown; charset=utf-8'
      );
      const received: ReceivedBugReport = {
        reporterId: report.reporterId,
        issue,
      };
      await writeUtf8(
        store,
        `${folder}/receipt.json`,
        JSON.stringify(received),
        JSON_TYPE
      );
      const day = new Date(clock.now()).toISOString().slice(0, 10);
      const own = takenFromDevice(day, report.reporterId);
      await writeUtf8(store, `${own}${report.id}`, '', 'text/plain');
      await writeUtf8(
        store,
        `limits/${day}/all/${report.id}`,
        '',
        'text/plain'
      );
      return issue;
    },
    async check() {
      await store.head(PROBE_KEY);
    },
  };
}

/** Records and files both in one object store: development and tests. */
export function objectStoreBugReportStore(
  store: ObjectStore,
  clock: Clock
): BugReportStore {
  return {
    records: objectStoreBugReportRecords(store, clock),
    attachments: objectStoreBugReportAttachments(store),
  };
}
