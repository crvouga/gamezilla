import type { SnapshotMedia } from '@crvouga/atlas-reports/report-types';

const TEXT_ENCODER = new TextEncoder();

/** Fast non-crypto content hash for change-gating identical frames. */
export function hashBytes(bytes: Uint8Array): string {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function hashString(value: string): string {
  return hashBytes(TEXT_ENCODER.encode(value));
}

export type EncodedSnapshot = {
  readonly bytes: Uint8Array;
  readonly hash: string;
  readonly contentType: string;
};

/**
 * Encode a capture value for a given media.
 * Returns null when the value should be skipped.
 */
export function encodeSnapshotValue(
  media: SnapshotMedia,
  value: unknown
): EncodedSnapshot | null {
  if (value === null || value === undefined) return null;
  switch (media) {
    case 'html':
    case 'text':
      return encodeTextMedia(media, value);
    case 'json':
      return encodeJsonMedia(value);
    case 'png':
    case 'bytes':
      return encodeBinaryMedia(media, value);
    default:
      return null;
  }
}

function encodeTextMedia(
  media: 'html' | 'text',
  value: unknown
): EncodedSnapshot | null {
  if (typeof value !== 'string') return null;
  if (value.trim() === '') return null;
  const bytes = TEXT_ENCODER.encode(value);
  return {
    bytes,
    hash: hashBytes(bytes),
    contentType:
      media === 'html'
        ? 'text/html; charset=utf-8'
        : 'text/plain; charset=utf-8',
  };
}

function encodeJsonMedia(value: unknown): EncodedSnapshot | null {
  const text = JSON.stringify(value);
  if (text === undefined) return null;
  const bytes = TEXT_ENCODER.encode(text);
  return {
    bytes,
    hash: hashBytes(bytes),
    contentType: 'application/json; charset=utf-8',
  };
}

function encodeBinaryMedia(
  media: 'png' | 'bytes',
  value: unknown
): EncodedSnapshot | null {
  if (!(value instanceof Uint8Array)) return null;
  if (value.byteLength === 0) return null;
  return {
    bytes: value,
    hash: hashBytes(value),
    contentType: media === 'png' ? 'image/png' : 'application/octet-stream',
  };
}

/**
 * Split a capture into per-node entries when the value is a Record of
 * string/Uint8Array keyed by node id (multi-actor UI). Otherwise one entry.
 */
export function splitCaptureNodes(
  media: SnapshotMedia,
  value: unknown
): readonly { readonly nodeId?: string; readonly value: unknown }[] {
  if (value === null || value === undefined) return [];
  if (isNodeMap(media, value)) {
    return Object.entries(value as Record<string, unknown>).map(
      ([nodeId, v]) => ({ nodeId, value: v })
    );
  }
  return [{ value }];
}

function isNodeMap(media: SnapshotMedia, value: unknown): boolean {
  if (
    media !== 'html' &&
    media !== 'png' &&
    media !== 'text' &&
    media !== 'json'
  ) {
    return false;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (value instanceof Uint8Array) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.every(([, v]) => {
    if (media === 'png') return v instanceof Uint8Array;
    if (media === 'json') {
      return v !== null && typeof v === 'object' && !(v instanceof Uint8Array);
    }
    return typeof v === 'string';
  });
}

export function padFrame(index: number): string {
  return String(index).padStart(5, '0');
}
