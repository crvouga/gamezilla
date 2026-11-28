import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import type { JourneyStepView } from './live-journey-step-evidence';

type Edges = { top: number; right: number; bottom: number; left: number };

type VisiblePart = {
  name: string;
  part: Edges;
  room: Edges;
};

// Measure the production DOM, including the client box inside native scrollbars.
const READ_BOARD_GEOMETRY = `(() => {
  const board = Array.from(document.querySelectorAll('[data-game-fixed] [data-game-board]')).find(node => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.top < innerHeight && box.bottom > 0;
  });
  const stage = board?.closest('[data-game-slot="stage"]');
  if (!stage) return [];
  const parts = [];
  function add(name, part, room) {
    if (!room || !part) return;
    const box = room.getBoundingClientRect();
    const left = box.left + room.clientLeft;
    const top = box.top + room.clientTop;
    parts.push({ name, part: part.toJSON(), room: {
      top: Math.max(top, 0), left: Math.max(left, 0),
      right: Math.min(left + room.clientWidth, innerWidth),
      bottom: Math.min(top + room.clientHeight, innerHeight)
    } });
  }
  function lines(name, group, room) {
    if (!group || !room) return;
    const walker = document.createTreeWalker(group, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const line of range.getClientRects()) {
        if (line.width && line.height) add(name, line, room);
      }
    }
  }
  const timer = stage.querySelector('[data-testid="multiplayer-first-move-countdown"]');
  lines('First-move countdown', timer, timer?.closest('[role="region"]'));
  const outline = stage.querySelector('[data-testid="game-session-record-outline"]');
  lines('Deal outline', outline, outline?.closest('[data-game-slot="history"]'));

  const window = board.querySelector('[role="region"][data-enlarged="true"]');
  if (window) {
    const { left, top } = window.getBoundingClientRect();
    const right = left + window.clientWidth;
    const bottom = top + window.clientHeight;
    for (const cell of window.querySelectorAll('[data-index][data-cell]')) {
      const box = cell.getBoundingClientRect();
      if (box.right > left && box.left < right && box.bottom > top && box.top < bottom) {
        add('Word Tiles square ' + cell.dataset.cell, box, window);
      }
    }
  }

  // On short or narrow screens the scrollable board is intentional.
  if (innerHeight < 700 || (stage.closest('[data-game-column]')?.clientWidth ?? 0) < 880) return parts;
  const rack = board.querySelector('[data-inspecting="false"][data-cells]');
  if (rack) {
    add('Connect Four rack', rack.getBoundingClientRect(), board);
    for (const column of rack.querySelectorAll('[data-column]')) {
      const bottom = column.querySelector('[data-cell]:last-child');
      add('Column ' + column.dataset.column + ' bottom cell', bottom?.getBoundingClientRect(), board);
    }
  }
  // Follow mode pans the world inside this visible SVG viewport.
  const arena = board.querySelector('[data-rider-count] > svg');
  if (arena) add('Light Cycles arena', arena.getBoundingClientRect(), board);
  return parts;
})()`;

/** Retain the screenshot and its measurements even when part of a board is clipped. */
export async function captureLiveBoardGeometry(
  view: JourneyStepView,
  store: ObjectStore,
  scenarioId: string
): Promise<void> {
  const parts = (await view.evaluate(READ_BOARD_GEOMETRY)) as VisiblePart[];
  if (parts.length === 0) return;
  await writeUtf8(
    store,
    `${scenarioId}.board/geometry.json`,
    JSON.stringify(parts)
  );
  for (const { name, part, room } of parts) {
    if (
      part.top < room.top - 1 ||
      part.bottom > room.bottom + 1 ||
      part.left < room.left - 1 ||
      part.right > room.right + 1
    ) {
      throw new Error(`${name} is clipped: ${JSON.stringify({ part, room })}`);
    }
  }
}
