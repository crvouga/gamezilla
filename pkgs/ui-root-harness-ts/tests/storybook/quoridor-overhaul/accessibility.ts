import type axe from 'axe-core';

/** Runs inside the browser; keep unresolved contrast checks and bounded context. */
export async function auditQuoridorAccessibility() {
  const result = await (window as unknown as { axe: typeof axe }).axe.run(
    '#storybook-root'
  );
  const nodes = result.incomplete
    .filter((rule) => rule.id === 'color-contrast')
    .flatMap((rule) => rule.nodes);
  const diagnostics = nodes.slice(0, 20).map((node) => {
    const selector = node.target[0];
    if (typeof selector !== 'string')
      return { target: node.target, unavailable: 'Nested target selector' };
    let element: Element | null;
    try {
      element = document.querySelector(selector);
    } catch {
      return { target: node.target, unavailable: 'Unsupported selector' };
    }
    if (!element) return { target: node.target, unavailable: 'Target missing' };
    const describe = (item: Element) => {
      const style = getComputedStyle(item);
      const rect = item.getBoundingClientRect();
      return {
        tag: item.tagName,
        component: item.getAttribute('data-component'),
        color: style.color,
        background: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        opacity: style.opacity,
        position: style.position,
        zIndex: style.zIndex,
        transform: style.transform,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    };
    const rect = element.getBoundingClientRect();
    return {
      target: node.target,
      element: describe(element),
      centerHitStack: document
        .elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        .slice(0, 6)
        .map(describe),
    };
  });
  return {
    ...result,
    contrastDiagnostics: {
      totalIncompleteNodes: nodes.length,
      sampledNodes: diagnostics,
      limit:
        'First 20 incomplete color-contrast nodes; center hit stack capped at six elements. Diagnostic only, not a contrast verdict.',
    },
  };
}
