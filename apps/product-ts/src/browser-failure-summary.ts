/** Failure logs retain rendered state even when the release profile keeps no reports. */
export function browserFailureSummary(html: string): string {
  const controls =
    html.match(/<[^>]*data-testid="multiplayer-[^"]+"[^>]*>/g) ?? [];
  const omit = /multiplayer-(?:board-|rating-|time-control-)/;
  const state = controls
    .filter((tag) => !omit.test(tag))
    .map((tag) =>
      tag.match(
        /data-(?:testid|game-id|outcome|revision|reason|phase|can-move|board-takes-moves)="[^"]*"/g
      )
    );
  const waiting = html
    .match(/data-testid="multiplayer-waiting"[^>]*>([\s\S]*?)<\/p>/)?.[1]
    ?.replace(/<[^>]*>/g, ' ');
  return JSON.stringify({
    screen: html.match(/data-screen="([^"]+)"/)?.[1],
    controls: state,
    waiting,
    text: html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(-2000),
  });
}

/** Only rendered geometry and sanitized control identifiers, never input values. */
export const BROWSER_FAILURE_LAYOUT = `(() => {
  const describe = el => el && ({ tag: el.tagName, component: el.dataset.component, testid: el.dataset.testid });
  return JSON.stringify({ visibility: document.visibilityState, width: innerWidth, height: innerHeight,
    controls: Array.from(document.querySelectorAll('[data-testid="multiplayer-find"]')).map(el => {
      const rect = el.getBoundingClientRect();
      const parents = [];
      for (let p = el; p !== null; p = p.parentElement) {
        const style = getComputedStyle(p);
        parents.push({ ...describe(p), rect: p.getBoundingClientRect().toJSON(), scrollTop: p.scrollTop,
          scrollHeight: p.scrollHeight, clientHeight: p.clientHeight, overflow: style.overflowY, position: style.position, opacity: style.opacity });
      }
      return { rect: rect.toJSON(), disabled: el.disabled, parents,
        hit: describe(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
    }) });
})()`;

/** CI retains the log tail: keep every device's screen after verbose transports. */
export function browserFailureLog(
  details: readonly string[],
  summaries: readonly string[]
): string {
  return [...details, ...summaries].join('\n');
}
