/**
 * Bun's selector click waits for a stable, topmost centre but never scrolls.
 * Keep its selected control in the viewport while that one gesture waits:
 * a late offline banner can move it after the locator's initial scroll.
 * Native actionability still decides whether a click can be delivered.
 */
export async function trackPressVisibility(
  view: { evaluate(script: string): Promise<unknown> },
  selector: string,
  press: () => Promise<void>
): Promise<void> {
  try {
    await view.evaluate(`(function () {
    var previous = window.__uiTestingPressVisibility;
    if (previous) cancelAnimationFrame(previous.frame);
    var state = { frame: 0 };
    window.__uiTestingPressVisibility = state;
    function track() {
      if (window.__uiTestingPressVisibility !== state) return;
      var el = document.querySelector(${JSON.stringify(selector)});
      if (el) {
        var r = el.getBoundingClientRect();
        var x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (r.width > 0 && r.height > 0 && (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight))
          el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      }
      state.frame = requestAnimationFrame(track);
    }
    state.frame = requestAnimationFrame(track);
  })()`);
    await press();
  } finally {
    // Navigation drops the old document's observer. A closed page cannot
    // retain it either; cleanup must preserve the original native failure.
    await view
      .evaluate(`(function () {
      var state = window.__uiTestingPressVisibility;
      if (state) cancelAnimationFrame(state.frame);
      delete window.__uiTestingPressVisibility;
    })()`)
      .catch(() => undefined);
  }
}
