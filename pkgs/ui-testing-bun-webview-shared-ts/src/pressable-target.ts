/**
 * The match a person could press: shown, scrolled into view, and on top at
 * its centre. Stacked screens keep earlier screens mounted underneath, so the
 * first match in document order is often covered.
 */
export function pressableTargetScript(
  selector: string,
  pressId: number
): string {
  return `(async function(){
    var selector = ${JSON.stringify(selector)};
    var id = ${JSON.stringify(pressId)};
    window.__uiTestingPressVisibility?.stop();
    // The page owns the frame and marker until native input lands or the page leaves.
    function track(target, marked) {
      var state = { id: id, selector: target, stop: stop };
      var frame = requestAnimationFrame(scrollIfNeeded);
      window.__uiTestingPressVisibility = state;
      window.addEventListener('pagehide', stop);
      function stop() {
        if (window.__uiTestingPressVisibility !== state) return;
        cancelAnimationFrame(frame);
        window.removeEventListener('pagehide', stop);
        if (marked) marked.removeAttribute('data-ui-testing-press-target');
        delete window.__uiTestingPressVisibility;
      }
      function scrollIfNeeded() {
        if (window.__uiTestingPressVisibility !== state) return;
        var el = document.querySelector(target);
        if (el) {
          var r = el.getBoundingClientRect();
          var x = r.left + r.width / 2, y = r.top + r.height / 2;
          if (r.width > 0 && r.height > 0 && (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight))
            el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        }
        frame = requestAnimationFrame(scrollIfNeeded);
      }
      return target;
    }
    var all = document.querySelectorAll(selector);
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      // The native selector click checks actionability. A unique control
      // needs no animation frames to distinguish it from a covered copy.
      if (all.length === 1) return track(selector, null);
      var previous = null;
      for (var frame = 0; frame < 18; frame++) {
        await new Promise(requestAnimationFrame);
        var r = el.getBoundingClientRect();
        var stable = previous !== null && previous.left === r.left && previous.top === r.top && previous.width === r.width && previous.height === r.height;
        previous = { left: r.left, top: r.top, width: r.width, height: r.height };
        if (!stable || r.width === 0 || r.height === 0) continue;
        var x = r.left + r.width / 2;
        var y = r.top + r.height / 2;
        var hit = document.elementFromPoint(x, y);
        if (hit !== null && (hit === el || el.contains(hit))) {
          el.setAttribute('data-ui-testing-press-target', String(id));
          return track('[data-ui-testing-press-target="' + id + '"]', el);
        }
      }
    }
    return null;
  })()`;
}
