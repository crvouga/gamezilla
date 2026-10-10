import type { SourceRecord } from '@crvouga/atlas-reports/protocol';
import { publishPart } from '@crvouga/atlas-reports/report-parts';
import { sourceParts } from '@crvouga/atlas-reports/source-part';
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
