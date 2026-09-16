/** Report viewer script, part 3: test detail (steps, frames, snapshots). */
export const VIEWER_JS_DETAIL = `
var PHONE_W = 390, PHONE_H = 844;

function selectedFrame(frames, route) {
  var n = parseInt(route.params.frame || '', 10);
  if (isFinite(n) && n >= 1 && n <= frames.length) return frames[n - 1];
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].step.status === 'failed') return frames[i];
  }
  return frames[frames.length - 1] || null;
}
function selectedNode(frame, route) {
  var uiBlobs = frame ? frame.frame.snapshots.filter(isUi) : [];
  var ids = uiBlobs.map(function (b) { return b.nodeId || ''; });
  if (route.params.node && ids.indexOf(route.params.node) >= 0) return route.params.node;
  if (frame && frame.step.actorId && ids.indexOf(frame.step.actorId) >= 0) return frame.step.actorId;
  return ids[0] === undefined ? null : ids[0];
}
function isUi(b) { return b.media === 'html' || b.media === 'png'; }
function goFrame(route, frame, node) {
  var params = Object.assign({}, route.params, { frame: frame ? String(frame.index + 1) : '' });
  if (node !== undefined) params.node = node || '';
  navigate({ view: 'test', testId: route.testId, params: params }, true);
}

function renderTestHead(test) {
  var m = test.report.meta;
  var head = h('div', { class: 'testhead' }, [
    h('h2', {}, [h('span', { class: 'dot ' + m.status }), m.title]),
    h('div', { class: 'kv' }, [
      h('span', { class: 'mono', text: m.testId }),
      h('span', { text: 'seed ' + m.seed }),
      h('span', { text: m.system + ' · ' + m.runtime }),
      h('span', { text: fmtMs(m.durationMs) }),
      m.sourceFile ? h('span', { class: 'mono', text: m.sourceFile + (m.sourceLine ? ':' + m.sourceLine : '') }) : null
    ])
  ]);
  return head;
}

function renderSteps(test, frames, sel, route) {
  var rows = flattenSteps(test.report.steps, [], 0, null);
  var collapsed = {};
  var container = h('div', { class: 'steps' });
  function visible(row) {
    for (var p = row.parent; p; p = p.parent) if (collapsed[p.index]) return false;
    return true;
  }
  function draw() {
    clear(container);
    rows.forEach(function (row) {
      if (!visible(row)) return;
      var step = row.step;
      var isSel = sel && sel.step === step;
      var hasKids = (step.steps || []).length > 0;
      var el = h('div', {
        class: 'step ' + step.status + (isSel ? ' sel' : ''),
        style: 'padding-left:' + (8 + row.depth * 16) + 'px',
        onclick: function () {
          var f = firstFrameFor(step, frames) || lastFrameBefore(step, frames);
          goFrame(route, f, undefined);
        }
      }, [
        h('span', {
          class: 'tw', text: hasKids ? (collapsed[row.index] ? '▸' : '▾') : '',
          onclick: function (e) { e.stopPropagation(); collapsed[row.index] = !collapsed[row.index]; draw(); }
        }),
        h('span', { class: 'dot st ' + step.status }),
        h('div', { class: 'body' }, [
          h('div', { class: 't' }, [
            h('span', { class: 'k', text: step.kind }),
            step.title,
            step.actorId ? h('span', { class: 'badge', style: 'margin-left:6px', text: step.actorId }) : null
          ]),
          step.selector ? h('div', { class: 'sel-txt', text: step.selector }) : null,
          step.detail ? h('div', { class: 'sel-txt', text: step.detail }) : null,
          step.error ? h('div', { class: 'err', text: step.error }) : null
        ]),
        h('span', { class: 'd', text: fmtMs(step.durationMs) })
      ]);
      container.appendChild(el);
    });
  }
  draw();
  return container;
}

function renderPhone(test, blob) {
  var wrap = h('div', { class: 'phone' });
  var frame = h('div', { class: 'frame' });
  if (blob.media === 'png') {
    var url = blobDataUrl(test, blob);
    frame.appendChild(url ? h('img', { class: 'shot', src: url }) : h('div', { class: 'nodata', text: 'missing image' }));
  } else {
    var html = blobText(test, blob);
    var iframe = h('iframe', { sandbox: '', width: PHONE_W, height: PHONE_H, title: blob.nodeId || blob.name });
    if (html !== null) iframe.setAttribute('srcdoc', frameSrcdoc(html));
    frame.appendChild(iframe);
  }
  wrap.appendChild(frame);
  function fit() {
    var w = wrap.clientWidth - 32, hh = wrap.clientHeight - 32;
    var s = Math.min(1, w / PHONE_W, hh / PHONE_H);
    if (!isFinite(s) || s <= 0) return;
    frame.style.width = (PHONE_W * s) + 'px';
    frame.style.height = (PHONE_H * s) + 'px';
    var inner = frame.firstChild;
    if (inner && inner.tagName === 'IFRAME') inner.style.transform = 'scale(' + s + ')';
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(wrap);
  else window.addEventListener('resize', fit);
  requestAnimationFrame(fit);
  return wrap;
}

function renderAside(test, frame) {
  var aside = h('div', { class: 'aside' });
  var others = frame ? frame.frame.snapshots.filter(function (b) { return !isUi(b); }) : [];
  if (others.length === 0) return null;
  others.forEach(function (b) {
    aside.appendChild(h('h3', { text: b.name + (b.nodeId ? ' · ' + b.nodeId : '') }));
    var text = blobText(test, b);
    if (text !== null && b.media === 'json') {
      try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (e) {}
    }
    aside.appendChild(h('pre', { text: text === null ? '(binary ' + fileName(b.file) + ')' : text }));
  });
  return aside;
}

function renderViewer(test, frames, sel, route) {
  var viewer = h('div', { class: 'viewer' });
  var node = selectedNode(sel, route);
  var uiBlobs = sel ? sel.frame.snapshots.filter(isUi) : [];
  var blob = null;
  uiBlobs.forEach(function (b) { if ((b.nodeId || '') === (node || '')) blob = b; });
  var idx = sel ? sel.index : -1;
  viewer.appendChild(h('div', { class: 'toolbar' }, [
    h('button', { disabled: idx <= 0, onclick: function () { goFrame(route, frames[idx - 1], undefined); } }, ['◂']),
    h('button', { disabled: idx < 0 || idx >= frames.length - 1, onclick: function () { goFrame(route, frames[idx + 1], undefined); } }, ['▸']),
    h('span', { text: sel ? 'Frame ' + (idx + 1) + ' / ' + frames.length + ' · ' + sel.step.title : 'No frames' }),
    h('span', { class: 'grow' }),
    sel ? h('span', { text: '+' + fmtMs(sel.frame.capturedAtMs - test.report.meta.startedAtMs) }) : null
  ]));
  if (uiBlobs.length > 1) {
    viewer.appendChild(h('div', { class: 'tabs' }, uiBlobs.map(function (b) {
      return h('button', {
        class: 'tab' + ((b.nodeId || '') === (node || '') ? ' on' : ''),
        text: b.nodeId || b.name,
        onclick: function () { goFrame(route, sel, b.nodeId || ''); }
      });
    })));
  }
  var stage = h('div', { class: 'stage' });
  stage.appendChild(blob ? renderPhone(test, blob) : h('div', { class: 'nodata', text: sel ? 'No UI snapshot in this frame' : 'This test captured no frames' }));
  var aside = renderAside(test, sel);
  if (aside) stage.appendChild(aside);
  viewer.appendChild(stage);
  viewer.appendChild(h('div', { class: 'strip' }, frames.map(function (f) {
    return h('div', {
      class: 'thumb' + (f === sel ? ' on' : '') + (f.step.status === 'failed' ? ' failed' : ''),
      onclick: function () { goFrame(route, f, undefined); }
    }, [h('div', { class: 'n', text: String(f.index + 1) }), h('div', { class: 't', text: f.step.title })]);
  })));
  return viewer;
}

function renderTest(root, route) {
  clear(root);
  var test = testById(route.testId);
  if (!test) { root.appendChild(h('div', { class: 'empty', text: 'Unknown test: ' + route.testId })); return; }
  var frames = flattenFrames(test.report.steps, [], 0);
  frames.sort(function (a, b) { return a.frame.capturedAtMs - b.frame.capturedAtMs; });
  frames.forEach(function (f, i) { f.index = i; });
  var sel = selectedFrame(frames, route);
  var side = h('div', { class: 'side' }, [
    renderTestHead(test),
    test.report.meta.error ? h('div', { class: 'error', text: test.report.meta.errorStack || test.report.meta.error }) : null,
    renderSteps(test, frames, sel, route)
  ]);
  root.appendChild(h('div', { class: 'detail' }, [side, h('div', { class: 'main' }, [renderViewer(test, frames, sel, route)])]));
  var selEl = side.querySelector('.step.sel');
  if (selEl && selEl.scrollIntoView) selEl.scrollIntoView({ block: 'nearest' });
}

function render() {
  var route = parseHash();
  var app = document.getElementById('app');
  clear(app);
  renderHeader(app, route);
  var content = h('div', { id: 'content', class: route.view === 'test' ? '' : 'scroll' });
  app.appendChild(content);
  if (route.view === 'test') renderTest(content, route); else renderList(content, route);
  document.title = (route.view === 'test' && testById(route.testId) ? testById(route.testId).report.meta.title + ' · ' : '') + DATA.title;
}
window.addEventListener('hashchange', render);
window.addEventListener('keydown', function (e) {
  var route = parseHash();
  if (route.view !== 'test' || e.target.tagName === 'INPUT') return;
  var test = testById(route.testId);
  if (!test) return;
  var frames = flattenFrames(test.report.steps, [], 0);
  frames.sort(function (a, b) { return a.frame.capturedAtMs - b.frame.capturedAtMs; });
  frames.forEach(function (f, i) { f.index = i; });
  var sel = selectedFrame(frames, route);
  var idx = sel ? sel.index : -1;
  if (e.key === 'ArrowLeft' && idx > 0) goFrame(route, frames[idx - 1], undefined);
  if (e.key === 'ArrowRight' && idx >= 0 && idx < frames.length - 1) goFrame(route, frames[idx + 1], undefined);
  if (e.key === 'Escape') navigate({ view: 'list', params: {} }, false);
});
render();
`;
