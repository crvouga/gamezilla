import type { HtmlReportTest } from '@pkgs/harness-shared/bundle';
import type { ReportStep } from '@pkgs/harness-shared/report-types';
import { testFrameKey } from '@pkgs/harness-shared/keys';
import type { BundleEntry } from './bundle';
import { remoteTestFileKey, remoteTestReportKey } from './keys';
import type { PublishSourceArgs } from './publish';

const JSON_TYPE = 'application/json; charset=utf-8';

function frameFiles(steps: readonly ReportStep[], out: Set<string>): void {
  for (const step of steps) {
    for (const frame of step.frames) {
      for (const blob of frame.snapshots) out.add(blob.file);
    }
    frameFiles(step.steps, out);
  }
}

export async function* sourceEntries(
  args: PublishSourceArgs,
  source: string,
  tests: readonly HtmlReportTest[],
  runId: string
): AsyncGenerator<BundleEntry> {
  for (const { report } of [...tests].sort((a, b) =>
    a.report.meta.testId < b.report.meta.testId ? -1 : 1
  )) {
    const { testId } = report.meta;
    yield {
      key: remoteTestReportKey(args.sha, source, testId),
      bytes: new TextEncoder().encode(JSON.stringify(report)),
      contentType: JSON_TYPE,
    };
    const files = new Set<string>();
    frameFiles(report.steps, files);
    for (const file of [...files].sort()) {
      const obj = await args.local.get(testFrameKey(runId, testId, file));
      if (obj === null) throw new Error(`Missing report snapshot: ${file}`);
      yield {
        key: remoteTestFileKey(args.sha, source, testId, file),
        bytes: new Uint8Array(await new Response(obj.body).arrayBuffer()),
        contentType: obj.contentType,
      };
    }
  }
}
