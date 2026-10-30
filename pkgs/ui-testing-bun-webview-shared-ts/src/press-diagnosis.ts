import type { Timers } from '@pkgs/clock-shared-ts/types';

/**
 * Why an element never became pressable, for the failure message. A tap
 * that times out as "not actionable" says nothing about the cause; this
 * reads the two things actionability depends on: whether the element held
 * still, and what a press at its centre would actually hit.
 */

/** Frames sampled for movement: enough to see an animation or a reflow loop. */
const FRAMES = 6;

/**
 * Page-side script resolving to one line: the element's box on each sampled
 * frame (or that it moved), and the element under its centre when that is
 * not the element itself.
 */
export function pressDiagnosisScript(selector: string): string {
  return `(async function(){
    function one(node) {
      var style = getComputedStyle(node);
      return '<' + node.tagName.toLowerCase().slice(0, 32) +
        ' position=' + style.position.slice(0, 12) +
        ' z=' + style.zIndex.slice(0, 12) + '>';
    }
    function describe(node) {
      if (node === null) return 'nothing';
      // An overlay is often a portal with no test id: name its ancestry.
      var chain = [];
      for (var at = node; at !== null && at !== document.body && chain.length < 4; at = at.parentElement)
        chain.push(one(at));
      return chain.join(' < ');
    }
    var el = document.querySelector(${JSON.stringify(selector)});
    if (el === null) return 'the element is gone';
    var boxes = [];
    for (var frame = 0; frame < ${FRAMES}; frame++) {
      await new Promise(requestAnimationFrame);
      var r = el.getBoundingClientRect();
      boxes.push([r.left, r.top, r.width, r.height].join(','));
    }
    var moving = boxes.some(function (box) { return box !== boxes[0]; });
    var r = el.getBoundingClientRect();
    var x = r.left + r.width / 2;
    var y = r.top + r.height / 2;
    var hit = document.elementFromPoint(x, y);
    var covered = hit !== null && hit !== el && !el.contains(hit);
    var style = getComputedStyle(el);
    return (moving ? 'moving: ' + boxes.join(' -> ') : 'still at ' + boxes[0]) +
      '; viewport ' + innerWidth + 'x' + innerHeight +
      '; connected=' + el.isConnected + '; matches=' + document.querySelectorAll(${JSON.stringify(selector)}).length +
      '; disabled=' + (el.disabled === true || el.getAttribute('aria-disabled') === 'true') +
      '; hidden=' + (style.display === 'none' || style.visibility === 'hidden') +
      '; centre (' + Math.round(x) + ',' + Math.round(y) + ') hits ' +
      (covered || hit === null ? describe(hit) : 'the element');
  })()`;
}

/** The diagnosis, or why it could not be read. Never throws. */
export async function diagnosePress(
  view: { evaluate(script: string): Promise<unknown> },
  selector: string,
  timers: Timers
): Promise<string> {
  let timeout: unknown;
  try {
    const deadline = new Promise<string>((resolve) => {
      timeout = timers.setTimeout(
        () => resolve('no diagnosis (deadline)'),
        1000
      );
    });
    const found = await Promise.race([
      view.evaluate(pressDiagnosisScript(selector)),
      deadline,
    ]);
    return typeof found === 'string' ? found.slice(0, 1500) : 'no diagnosis';
  } catch {
    return 'no diagnosis (unavailable)';
  } finally {
    timers.clearTimeout(timeout);
  }
}
