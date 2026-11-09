import { expect, test } from 'bun:test';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

/** Synthetic layout verifies the sizing adapter; hosted captures prove geometry. */
function mountStage(input: {
  viewportWidth: number;
  viewportHeight: number;
  top: number;
  width: number;
  chrome: number;
  fit?: 'square';
}) {
  const view = document.defaultView;
  if (!view) throw new Error('Missing test window');
  const previousWidth = view.innerWidth;
  const previousHeight = view.innerHeight;
  const previousRect = HTMLElement.prototype.getBoundingClientRect;
  Object.defineProperty(view, 'innerWidth', {
    configurable: true,
    value: input.viewportWidth,
  });
  Object.defineProperty(view, 'innerHeight', {
    configurable: true,
    value: input.viewportHeight,
  });
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.dataset['component'] !== 'GameBoardStage')
      return new DOMRect(0, 0, input.viewportWidth, input.viewportHeight);
    const constrained = Number.parseFloat(
      this.style.getPropertyValue('--game-board-fit')
    );
    const width = Number.isNaN(constrained)
      ? input.width
      : Math.min(input.width, constrained);
    return new DOMRect(0, input.top, width, width + input.chrome);
  };
  const [fit, setFit] = createSignal(input.fit);
  const props = {
    get viewportFit() {
      return fit();
    },
  };
  const mounted = render(() => (
    <GameBoardStage {...props}>
      <span>Board</span>
    </GameBoardStage>
  ));
  const stage = mounted.container.querySelector<HTMLElement>(
    '[data-component="GameBoardStage"]'
  );
  if (!stage) throw new Error('Missing stage');
  stage.dispatchEvent(new Event('ui-testing:element-layout'));
  return {
    stage,
    setFit,
    dispose() {
      mounted.unmount();
      HTMLElement.prototype.getBoundingClientRect = previousRect;
      Object.defineProperty(view, 'innerWidth', {
        configurable: true,
        value: previousWidth,
      });
      Object.defineProperty(view, 'innerHeight', {
        configurable: true,
        value: previousHeight,
      });
    },
  };
}

// regression: chess-completed-board-below-viewport
test('viewport square stage budgets the 1440x900 completed board and player chrome', () => {
  const mounted = mountStage({
    viewportWidth: 1440,
    viewportHeight: 900,
    top: 322,
    width: 632,
    chrome: 176,
    fit: 'square',
  });
  try {
    expect(mounted.stage.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      884
    );
    const fit = mounted.stage.style.getPropertyValue('--game-board-fit');
    mounted.stage.dispatchEvent(new Event('ui-testing:element-layout'));
    expect(mounted.stage.style.getPropertyValue('--game-board-fit')).toBe(fit);
    mounted.setFit(undefined);
    expect(mounted.stage.style.getPropertyValue('--game-board-fit')).toBe('');
  } finally {
    mounted.dispose();
  }
});

// regression: chess-tablet-player-strip-below-viewport
test('viewport square stage budgets active tablet player strips at 768x900', () => {
  const mounted = mountStage({
    viewportWidth: 768,
    viewportHeight: 900,
    top: 188,
    width: 560,
    chrome: 176,
    fit: 'square',
  });
  try {
    expect(mounted.stage.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      884
    );
  } finally {
    mounted.dispose();
  }
});

test('viewport square stage keeps phone targets and the default stage unchanged', () => {
  for (const fit of [undefined, 'square'] as const) {
    const mounted = mountStage({
      viewportWidth: 390,
      viewportHeight: 600,
      top: 188,
      width: 342,
      chrome: 176,
      ...(fit ? { fit } : {}),
    });
    try {
      expect(mounted.stage.style.getPropertyValue('--game-board-fit')).toBe('');
    } finally {
      mounted.dispose();
    }
  }
});

test('viewport square stage falls back to scrolling rather than shrinking below its target floor', () => {
  const mounted = mountStage({
    viewportWidth: 1440,
    viewportHeight: 500,
    top: 322,
    width: 632,
    chrome: 176,
    fit: 'square',
  });
  try {
    expect(mounted.stage.getBoundingClientRect().width).toBe(360);
  } finally {
    mounted.dispose();
  }
});
