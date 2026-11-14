import {
  mediaExtension,
  testFrameKey,
} from '@crvouga/atlas/reports/recording-keys';
import type {
  ReportSnapshotBlob,
  SnapshotMedia,
} from '@crvouga/atlas/reports/report-types';
import { sanitizeTestId } from '@crvouga/atlas/reports/report-types';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
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

/** A part one test already stored, by {@link storedPartKey}. */
export type StoredParts = Map<
  string,
  { readonly bytes: Uint8Array; readonly blob: ReportSnapshotBlob }
>;

function storedPartKey(part: CapturedPart): string {
  return `${part.name}\0${part.nodeId ?? ''}\0${part.encoded.hash}`;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Mint frame files for the parts and persist them when a store is set. A part
 * the test already stored byte for byte reuses that file: one person's screen
 * is unchanged while another person acts far more often than not.
 */
export async function persistSnapshotParts(args: {
  readonly parts: readonly CapturedPart[];
  readonly store: ObjectStore | undefined;
  readonly runId: string;
  readonly testId: string;
  readonly nextSeq: () => number;
  readonly stored: StoredParts;
}): Promise<ReportSnapshotBlob[]> {
  const blobs: ReportSnapshotBlob[] = [];
  const planned: PlannedPart[] = [];
  for (const part of args.parts) {
    const key = storedPartKey(part);
    const known = args.stored.get(key);
    if (known !== undefined && sameBytes(known.bytes, part.encoded.bytes)) {
      blobs.push(known.blob);
      continue;
    }
    const item = planPart(args, part);
    const blob = blobOf(item);
    planned.push(item);
    blobs.push(blob);
    args.stored.set(key, { bytes: part.encoded.bytes, blob });
  }
  await putPlanned(args, planned);
  return blobs;
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
