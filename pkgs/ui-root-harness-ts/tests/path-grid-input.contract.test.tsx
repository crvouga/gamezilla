import { expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { PathGridBoard } from '@pkgs/ui-root-client-ts/path-grid-board';
import { pathGridSegment } from '@pkgs/ui-root-client-ts/path-grid-pointer';
import { fireEvent } from '@solidjs/testing-library';
import fc from 'fast-check';
import { createSignal } from 'solid-js';
import PathGridBoardExample from '../../ui-root-client-ts/src/path-grid-board/path-grid-board.example';
import { renderUi as render } from './render';

test('pointer sample expansion stays in bounds and visits adjacent cells through the final sample', () => {
  assertProperty(
    'path-grid-segment',
    fc.property(
      fc.integer({ min: 2, max: 20 }),
      fc.integer({ min: 2, max: 20 }),
      fc.tuple(
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999 })
      ),
      (columns, rows, coordinates) => {
        const at = (n: number, count: number) =>
          0.125 + (n / 1000) * (count - 0.25);
        const from = {
          x: at(coordinates[0], columns),
          y: at(coordinates[1], rows),
        };
        const to = {
          x: at(coordinates[2], columns),
          y: at(coordinates[3], rows),
        };
        const origin = Math.floor(from.y) * columns + Math.floor(from.x);
        const route = [origin, ...pathGridSegment(from, to, { columns, rows })];
        expect(route.at(-1)).toBe(
          Math.floor(to.y) * columns + Math.floor(to.x)
        );
        expect(new Set(route).size).toBe(route.length);
        for (const [index, cell] of route.entries()) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThan(columns * rows);
          if (index === 0) continue;
          const previous = route[index - 1];
          if (previous === undefined) throw new Error('Missing preceding cell');
          expect(
            Math.abs((cell % columns) - (previous % columns)) +
              Math.abs(
                Math.floor(cell / columns) - Math.floor(previous / columns)
              )
          ).toBe(1);
        }
      }
    )
  );
});

function fixture() {
  const log: string[] = [];
  const [disabled, setDisabled] = createSignal(false);
  const [connected, setConnected] = createSignal(false);
  const view = render(() => (
    <PathGridBoard
      columns={3}
      rows={2}
      label="Path grid"
      testId="path-grid"
      disabled={disabled()}
      endpoints={[
        { cell: 0, label: '1', tone: 'red', connected: connected() },
        { cell: 2, label: '1', tone: 'red', connected: connected() },
      ]}
      lines={[
        {
          id: 'one',
          tone: 'red',
          cells: connected() ? [0, 1, 2] : [0, 1],
          connected: connected(),
        },
      ]}
      cellLabel={(index) =>
        `Cell ${index}${index === 0 || index === 2 ? ', pair 1' : ''}${connected() ? ', connected' : ''}`
      }
      onActivate={(index) => log.push(`activate:${index}`)}
      onNavigate={(index) => log.push(`navigate:${index}`)}
      onCellKey={(key) => {
        if (key !== 'Escape') return false;
        log.push('escape');
        return true;
      }}
      onTraceStart={(index) => log.push(`start:${index}`)}
      onTraceMove={(index) => log.push(`move:${index}`)}
      onTraceEnd={() => log.push('end')}
      onTraceCancel={() => log.push('cancel')}
    />
  ));
  const root = view.getByRole('group', { name: 'Path grid' });
  root.setPointerCapture = (id) => log.push(`capture:${id}`);
  root.releasePointerCapture = (id) => log.push(`release:${id}`);
  root.getBoundingClientRect = () => ({
    x: 10,
    y: 20,
    left: 10,
    top: 20,
    right: 250,
    bottom: 180,
    width: 240,
    height: 160,
    toJSON: () => ({}),
  });
  const pointer = (type: string, x: number, y: number, pointerId = 1) =>
    fireEvent(
      root,
      new PointerEvent(type, {
        clientX: 10 + x,
        clientY: 20 + y,
        pointerId,
        button: 0,
        isPrimary: true,
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
      })
    );
  return { view, root, log, pointer, setDisabled, setConnected };
}

test('one captured pointer expands fast drags; a different pointer and synthetic click do not duplicate them', () => {
  const f = fixture();
  f.pointer('pointerdown', 40, 40);
  f.pointer('pointermove', 200, 40, 2);
  f.pointer('pointerup', 200, 40);
  fireEvent.click(f.view.getByRole('button', { name: 'Cell 2, pair 1' }), {
    detail: 1,
  });
  expect(f.log).toEqual([
    'capture:1',
    'start:0',
    'move:1',
    'move:2',
    'release:1',
    'end',
  ]);
  f.view.unmount();
});

test('cancellation, lost capture and disabling discard the trace once without committing it', () => {
  const f = fixture();
  f.pointer('pointerdown', 40, 40);
  f.pointer('pointercancel', 120, 40);
  f.pointer('lostpointercapture', 120, 40);
  f.pointer('pointerup', 120, 40);
  expect(f.log).toEqual(['capture:1', 'start:0', 'release:1', 'cancel']);
  f.pointer('pointerdown', 40, 40);
  f.setDisabled(true);
  f.pointer('pointerup', 200, 40);
  fireEvent.click(f.view.getByRole('button', { name: 'Cell 0, pair 1' }));
  expect(f.log).toEqual([
    'capture:1',
    'start:0',
    'release:1',
    'cancel',
    'capture:1',
    'start:0',
    'release:1',
    'cancel',
  ]);
  f.view.unmount();
});

test('keyboard focus is stable while paths update and disabled controls remain readable', () => {
  const f = fixture();
  const first = f.view.getByRole('button', { name: 'Cell 0, pair 1' });
  const last = f.view.getByRole('button', { name: 'Cell 5' });
  first.focus();
  fireEvent.keyDown(first, { key: 'End', ctrlKey: true });
  expect(document.activeElement).toBe(last);
  expect(f.log).toEqual(['navigate:5']);
  expect(last.tabIndex).toBe(0);
  expect(first.tabIndex).toBe(-1);
  fireEvent.click(last, { detail: 0 });
  fireEvent.keyDown(last, { key: 'Escape' });
  expect(f.log).toEqual(['navigate:5', 'activate:5', 'escape']);
  f.setConnected(true);
  expect(f.view.getByRole('button', { name: 'Cell 5, connected' })).toBe(last);
  expect(document.activeElement).toBe(last);
  expect(
    f.root.querySelector('[data-path="one"]')?.getAttribute('points')
  ).toBe('50,50 150,50 250,50');
  expect(
    f.root.querySelector('[data-path="one"]')?.getAttribute('data-connected')
  ).toBe('true');
  f.setDisabled(true);
  expect(first.getAttribute('aria-disabled')).toBe('true');
  expect(auditTree(f.root).map(formatFailure)).toEqual([]);
  f.view.unmount();
});

test('the explorer renders every path color and its disabled state', () => {
  const [disabled, setDisabled] = createSignal(false);
  const view = render(() => <PathGridBoardExample disabled={disabled()} />);
  const root = view.getByRole('group', { name: 'Labeled path colors' });
  expect(root.querySelectorAll('polyline').length).toBe(6);
  setDisabled(true);
  expect(root.querySelector('button')?.getAttribute('aria-disabled')).toBe(
    'true'
  );
  view.unmount();
});
