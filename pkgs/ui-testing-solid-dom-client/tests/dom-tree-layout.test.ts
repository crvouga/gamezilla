import { describe, expect, test } from 'bun:test';
import { layoutDomTree } from '@pkgs/ui-testing-solid-dom-client/dom-tree-layout';
import { Window } from 'happy-dom';

describe('layoutDomTree', () => {
  test('places header overflow trigger on the trailing edge', () => {
    const window = new Window({ url: 'https://localhost/' });
    const root = window.document.createElement('div');
    root.innerHTML = `
      <div class="box flex-row" style="height:56px;width:390px">
        <div class="box flex-1 flex-row">
          <div class="box justify-start flex-1"></div>
          <div class="box justify-end flex-1 flex-row">
            <div class="box" data-component="OverflowMenuButton" id="trigger"></div>
          </div>
        </div>
      </div>`;
    window.document.body.appendChild(root);
    layoutDomTree(root as unknown as HTMLElement, { width: 390, height: 56 });
    const trigger = root.querySelector('#trigger');
    if (trigger === null) throw new Error('expected #trigger');
    const rect = trigger.getBoundingClientRect();
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.top).toBeLessThan(60);
    expect(rect.left).toBeGreaterThan(200);
    expect(rect.right).toBeLessThanOrEqual(390);
  });

  test('ScreenBaseHeader AbsoluteCenter does not collapse under a w-full row', () => {
    const window = new Window({ url: 'https://localhost/' });
    const root = window.document.createElement('div');
    // Mirrors TopBar + AbsoluteCenter: header is not flex-1, inner row is w-full.
    root.innerHTML = `
      <header class="box bg-transparent" data-component="ScreenBaseHeader">
        <div class="box flex-row items-center gap-2 px-3 w-full" style="height:56px;min-height:56px">
          <div class="box relative flex-1 min-w-0 self-stretch flex-row items-center">
            <div class="box justify-start flex-1 flex-row"></div>
            <div class="box justify-end flex-1 flex-row">
              <div class="box flex-row items-center gap-1">
                <div class="box" data-component="OverflowMenuButton" id="trigger"></div>
              </div>
            </div>
          </div>
        </div>
      </header>`;
    window.document.body.appendChild(root);
    layoutDomTree(root as unknown as HTMLElement, { width: 390, height: 844 });
    const header = root.querySelector('header');
    const trigger = root.querySelector('#trigger');
    if (header === null) throw new Error('expected header');
    if (trigger === null) throw new Error('expected #trigger');
    expect(header.getBoundingClientRect().width).toBe(390);
    expect(trigger.getBoundingClientRect().left).toBeGreaterThan(200);
  });
});
