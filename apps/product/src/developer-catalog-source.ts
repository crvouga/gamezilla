import { testFrameKey, testReportKey } from '@pkgs/harness-root-shared/keys';
import type { RunReportMeta } from '@pkgs/harness-root-shared/report-types';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { recordedReport } from './developer-report';

export async function catalogSource(metas: readonly RunReportMeta[]) {
  const local = new ObjectStoreImplInMemory();
  const recorded = recordedReport('current');
  for (const meta of metas) {
    await writeUtf8(
      local,
      testReportKey('latest', meta.testId),
      JSON.stringify({ ...recorded.report, meta }),
      'application/json'
    );
    for (const [file, blob] of Object.entries(recorded.blobs)) {
      if (blob.text === undefined)
        throw new Error(`Catalog snapshot is not text: ${file}`);
      await writeUtf8(
        local,
        testFrameKey('latest', meta.testId, file),
        blob.text,
        blob.contentType
      );
    }
  }
  return local;
}
