import { expect, test } from 'bun:test';
import { ELEMENT_LAYOUT_EVENT } from '@pkgs/ui-testing-solid-dom-client/dom-layout';
import { layoutDomTree } from '@pkgs/ui-testing-solid-dom-client/dom-tree-layout';

// regression: solid-dom-unchanged-layout-remeasures
test('an unchanged 390 by 844 layout does not notify measurements again', () => {
  const root = document.createElement('div');
  const child = root.appendChild(document.createElement('div'));
  child.className = 'box flex-1';
  document.body.appendChild(root);
  const rootWidths: number[] = [];
  const childWidths: number[] = [];
  root.addEventListener(ELEMENT_LAYOUT_EVENT, () => {
    rootWidths.push(root.getBoundingClientRect().width);
  });
  child.addEventListener(ELEMENT_LAYOUT_EVENT, () => {
    childWidths.push(child.getBoundingClientRect().width);
  });
  try {
    layoutDomTree(root, { width: 390, height: 844 });
    layoutDomTree(root, { width: 390, height: 844 });
    expect(rootWidths).toEqual([390]);
    expect(childWidths).toEqual([390]);
    layoutDomTree(root, { width: 400, height: 844 });
    expect(rootWidths).toEqual([390, 400]);
    expect(childWidths).toEqual([390, 400]);
    expect(child.getBoundingClientRect().height).toBe(844);
  } finally {
    root.remove();
  }
});
