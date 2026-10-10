import {
  mediaExtension,
  testFrameKey,
} from '@crvouga/atlas-reports/recording-keys';
import type {
  ReportSnapshotBlob,
  SnapshotMedia,
} from '@crvouga/atlas-reports/report-types';
import { sanitizeTestId } from '@crvouga/atlas-reports/report-types';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import type { CatalogSnapshot } from './define-snapshot';
import type { EncodedSnapshot } from './encode';
import { encodeSnapshotValue, padFrame, splitCaptureNodes } from './encode';

export type CapturedPart = {
  readonly name: string;
  readonly media: SnapshotMedia;
  readonly nodeId?: string;
  readonly encoded: EncodedSnapshot;
};

export type CapturedFrame = {
  readonly parts: readonly CapturedPart[];
  /** Content hash over every part — equal hashes mean an identical frame. */
  readonly frameHash: string;
};

/** Run every registered snapshotter once and encode the results. */
export async function captureSnapshotParts(
  snapshots: readonly CatalogSnapshot<unknown>[],
  surface: unknown
): Promise<CapturedFrame> {
  const parts: CapturedPart[] = [];
  const hashParts: string[] = [];
  for (const snap of snapshots) {
    const raw = await snap.capture(surface);
    for (const part of splitCaptureNodes(snap.media, raw)) {
      const encoded = encodeSnapshotValue(snap.media, part.value);
      if (encoded === null) continue;
      hashParts.push(`${snap.name}:${part.nodeId ?? ''}:${encoded.hash}`);
      parts.push({
        name: snap.name,
        media: snap.media,
        ...(part.nodeId !== undefined ? { nodeId: part.nodeId } : {}),
        encoded,
      });
    }
  }
  return { parts, frameHash: hashParts.join('|') };
}

function frameFileName(args: {
  readonly seq: number;
  readonly name: string;
  readonly media: string;
  readonly nodeId?: string;
}): string {
  const base = `frames/f-${padFrame(args.seq)}.${sanitizeTestId(args.name)}`;
  const node =
    args.nodeId !== undefined ? `.${sanitizeTestId(args.nodeId)}` : '';
  return `${base}${node}.${mediaExtension(args.media)}`;
}

/** Mint frame files for the parts and persist them when a store is set. */
export async function persistSnapshotParts(args: {
  readonly parts: readonly CapturedPart[];
  readonly store: ObjectStore | undefined;
  readonly runId: string;
  readonly testId: string;
  readonly nextSeq: () => number;
}): Promise<ReportSnapshotBlob[]> {
  const blobs: ReportSnapshotBlob[] = [];
  for (const part of args.parts) {
    const file = frameFileName({
      seq: args.nextSeq(),
      name: part.name,
      media: part.media,
      ...(part.nodeId !== undefined ? { nodeId: part.nodeId } : {}),
    });
    if (args.store !== undefined) {
      await args.store.put(
        testFrameKey(args.runId, args.testId, file),
        part.encoded.bytes,
        part.encoded.contentType
      );
    }
    blobs.push({
      name: part.name,
      media: part.media,
      file,
      ...(part.nodeId !== undefined ? { nodeId: part.nodeId } : {}),
    });
  }
  return blobs;
}
