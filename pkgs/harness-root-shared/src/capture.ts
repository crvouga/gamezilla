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

type PlannedPart = {
  readonly part: CapturedPart;
  readonly file: string;
};

/** Mint frame files for the parts and persist them when a store is set. */
export async function persistSnapshotParts(args: {
  readonly parts: readonly CapturedPart[];
  readonly store: ObjectStore | undefined;
  readonly runId: string;
  readonly testId: string;
  readonly nextSeq: () => number;
}): Promise<ReportSnapshotBlob[]> {
  const planned = args.parts.map((part) => planPart(args, part));
  await putPlanned(args, planned);
  return planned.map((item) => blobOf(item));
}

function planPart(
  args: { readonly nextSeq: () => number },
  part: CapturedPart
): PlannedPart {
  return {
    part,
    file: frameFileName({
      seq: args.nextSeq(),
      name: part.name,
      media: part.media,
      ...(part.nodeId !== undefined ? { nodeId: part.nodeId } : {}),
    }),
  };
}

/** Frame parts are independent files. Write them together; the names stay ordered. */
async function putPlanned(
  args: {
    readonly store: ObjectStore | undefined;
    readonly runId: string;
    readonly testId: string;
  },
  planned: readonly PlannedPart[]
): Promise<void> {
  const store = args.store;
  if (store === undefined) return;
  await Promise.all(
    planned.map((item) =>
      store.put(
        testFrameKey(args.runId, args.testId, item.file),
        item.part.encoded.bytes,
        item.part.encoded.contentType
      )
    )
  );
}

function blobOf(item: PlannedPart): ReportSnapshotBlob {
  return {
    name: item.part.name,
    media: item.part.media,
    file: item.file,
    ...(item.part.nodeId !== undefined ? { nodeId: item.part.nodeId } : {}),
  };
}
