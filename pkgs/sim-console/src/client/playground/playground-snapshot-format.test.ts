import { describe, expect, test } from 'bun:test';

import {
  formatSnapshotAge,
  formatSnapshotBytes,
} from './playground-snapshot-format';

describe('formatSnapshotBytes', () => {
  test('formats bytes through GiB', () => {
    expect(formatSnapshotBytes(0)).toBe('0 B');
    expect(formatSnapshotBytes(512)).toBe('512 B');
    expect(formatSnapshotBytes(1024)).toBe('1.0 KiB');
    expect(formatSnapshotBytes(1536)).toBe('1.5 KiB');
    expect(formatSnapshotBytes(1024 ** 2)).toBe('1.0 MiB');
    expect(formatSnapshotBytes(1.5 * 1024 ** 2)).toBe('1.5 MiB');
    expect(formatSnapshotBytes(1024 ** 3)).toBe('1.00 GiB');
  });

  test('non-finite and negative become 0 B', () => {
    expect(formatSnapshotBytes(-1)).toBe('0 B');
    expect(formatSnapshotBytes(Number.NaN)).toBe('0 B');
  });
});

describe('formatSnapshotAge', () => {
  test('relative ages', () => {
    const now = 1_000_000;
    expect(formatSnapshotAge(now, now)).toBe('0s ago');
    expect(formatSnapshotAge(now - 90_000, now)).toBe('1m ago');
  });
});
