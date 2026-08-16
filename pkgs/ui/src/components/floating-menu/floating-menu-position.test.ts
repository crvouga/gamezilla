import { describe, expect, test } from 'bun:test';
import { windowRectToHostLocal } from '../portal-host-frame';
import { computeFloatingMenuPosition } from './floating-menu-position';

describe('computeFloatingMenuPosition', () => {
  const insets = { top: 0, bottom: 0 };
  const menuWidth = 200;
  const menuHeight = 120;

  test('places menu below host-local anchor near top of nested panel', () => {
    const host = { x: 120, y: 80, width: 400, height: 700 };
    const windowAnchor = { x: 480, y: 96, width: 32, height: 32 };
    const local = windowRectToHostLocal(windowAnchor, host);
    const pos = computeFloatingMenuPosition({
      anchor: local,
      menuHeight,
      menuWidth,
      insets,
      viewport: { width: host.width, height: host.height },
    });
    // Right-aligned under trigger: local.x + width - menuWidth
    expect(pos.left).toBe(local.x + local.width - menuWidth);
    expect(pos.top).toBe(local.y + local.height + 6);
  });

  test('clamps to host width, not full window', () => {
    const host = { x: 500, y: 100, width: 360, height: 640 };
    const local = { x: 300, y: 40, width: 40, height: 40 };
    const pos = computeFloatingMenuPosition({
      anchor: local,
      menuHeight,
      menuWidth,
      insets,
      viewport: { width: host.width, height: host.height },
    });
    // Without host clamp, left would be 140; with clamp to host 360: still 140
    // Push further right so clamp engages:
    const far = computeFloatingMenuPosition({
      anchor: { x: 340, y: 40, width: 40, height: 40 },
      menuHeight,
      menuWidth,
      insets,
      viewport: { width: host.width, height: host.height },
    });
    expect(far.left).toBe(host.width - menuWidth - 8);
    expect(pos.left).toBe(local.x + local.width - menuWidth);
  });

  test('flips above when not enough room below in host viewport', () => {
    const viewport = { width: 400, height: 300 };
    const pos = computeFloatingMenuPosition({
      anchor: { x: 100, y: 250, width: 32, height: 32 },
      menuHeight,
      menuWidth,
      insets,
      viewport,
    });
    expect(pos.top).toBe(250 - menuHeight - 6);
  });
});
