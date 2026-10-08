import type { SourceRecord } from '@pkgs/harness-report-shared/protocol';
import { publishPart } from '@pkgs/harness-report-shared/report-parts';
import { sourceParts } from '@pkgs/harness-report-shared/source-part';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';

export async function publishPartOutput(args: {
  readonly store: ObjectStore;
  readonly sha: string;
  readonly source: SourceRecord;
  readonly recordedAtMs: number;
}): Promise<void> {
  for (const part of sourceParts(args.sha, args.source))
    await publishPart(args.store, { ...part, recordedAtMs: args.recordedAtMs });
}
