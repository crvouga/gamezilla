import { expect, test } from 'bun:test';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { render } from '@solidjs/testing-library';

/** Synthetic layout for the sizing adapter; hosted captures prove geometry. */
function stageWidth(element: HTMLElement, natural: number): number {
  const fit = Number.parseFloat(
    element.style.getPropertyValue('--game-board-fit')
  );
  return Number.isNaN(fit) ? natural : Math.min(natural, fit);
}

// regression: game-frame-actions-below-tablet-fold
test('a square stage leaves room for the action row laid out under it', () => {
  const view = document.defaultView;
  if (!view) throw new Error('Missing test window');
  const previous = {
    width: view.innerWidth,
    height: view.innerHeight,
    rect: HTMLElement.prototype.getBoundingClientRect,
  };
  const set = (key: 'innerWidth' | 'innerHeight', value: number) =>
    Object.defineProperty(view, key, { configurable: true, value });
  set('innerWidth', 768);
  set('innerHeight', 900);
  const top = 188;
  const chrome = 176;
  const actions = 60;
  let stage: HTMLElement | null = null;
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset['component'] === 'GameBoardStage') {
      const width = stageWidth(this, 560);
      return new DOMRect(0, top, width, width + chrome);
    }
    if (this.dataset['testid'] === 'actions' && stage) {
      const bottom = stage.getBoundingClientRect().bottom;
      return new DOMRect(0, bottom + 8, 560, actions);
    }
    return new DOMRect(0, 0, 768, 900);
  };
  const mounted = render(() => (
    <div>
      <div>
        <GameBoardStage viewportFit="square">
          <span>Board</span>
        </GameBoardStage>
      </div>
      <div data-testid="actions" />
    </div>
  ));
  try {
    stage = mounted.container.querySelector<HTMLElement>(
      '[data-component="GameBoardStage"]'
    );
    if (!stage) throw new Error('Missing stage');
    stage.dispatchEvent(new Event('ui-testing:element-layout'));
    const bottom = stage.getBoundingClientRect().bottom;
    expect(bottom + 8 + actions).toBeLessThanOrEqual(900);
  } finally {
    mounted.unmount();
    HTMLElement.prototype.getBoundingClientRect = previous.rect;
    set('innerWidth', previous.width);
    set('innerHeight', previous.height);
  }
});
