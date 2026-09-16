/**
 * Report viewer script, part 1: data access, formatting, hash routing, and
 * the frame model shared by the list and detail views.
 */
export const VIEWER_JS_DATA = `
'use strict';
var DATA = JSON.parse(document.getElementById('report-data').textContent);
var FRAME_CSS = document.getElementById('frame-css').textContent;
var SHELL_LINK_RE = /<link\\b[^>]*href=["'][^"']*snapshot-shell\\.css["'][^>]*>\\s*/gi;
var SCRIPT_RE = /<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi;

function h(tag, attrs, children) {
  var el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v === null || v === undefined || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  });
  (children || []).forEach(function (c) {
    if (c === null || c === undefined || c === false) return;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
function fmtMs(ms) {
  if (ms === null || ms === undefined || !isFinite(ms)) return '—';
  if (ms < 1000) return Math.round(ms) + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  return Math.floor(ms / 60000) + 'm ' + Math.round((ms % 60000) / 1000) + 's';
}
function fmtDate(ms) {
  if (!ms) return '';
  try { return new Date(ms).toLocaleString(); } catch (e) { return String(ms); }
}
function fileName(path) { return path ? path.split('/').pop() : ''; }

function flattenFrames(steps, out, depth) {
  steps.forEach(function (step) {
    step.frames.forEach(function (frame) {
      out.push({ step: step, frame: frame, depth: depth, index: out.length });
    });
    flattenFrames(step.steps || [], out, depth + 1);
  });
  return out;
}
function flattenSteps(steps, out, depth, parent) {
  steps.forEach(function (step) {
    var row = { step: step, depth: depth, parent: parent, index: out.length };
    out.push(row);
    flattenSteps(step.steps || [], out, depth + 1, row);
  });
  return out;
}
function firstFrameFor(step, frames) {
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].step === step) return frames[i];
  }
  var kids = step.steps || [];
  for (var j = 0; j < kids.length; j++) {
    var f = firstFrameFor(kids[j], frames);
    if (f) return f;
  }
  return null;
}
function lastFrameBefore(step, frames) {
  var best = null;
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].frame.capturedAtMs <= step.endedAtMs) best = frames[i];
  }
  return best;
}
function stepHasStatus(step, status) {
  if (step.status === status) return true;
  return (step.steps || []).some(function (s) { return stepHasStatus(s, status); });
}

function testById(id) {
  for (var i = 0; i < DATA.tests.length; i++) {
    if (DATA.tests[i].report.meta.testId === id) return DATA.tests[i];
  }
  return null;
}
function blobText(test, blob) {
  var b = test.blobs[blob.file];
  return b && typeof b.text === 'string' ? b.text : null;
}
function blobDataUrl(test, blob) {
  var b = test.blobs[blob.file];
  if (!b || !b.base64) return null;
  return 'data:' + b.contentType + ';base64,' + b.base64;
}
function frameSrcdoc(html) {
  var cleaned = html.replace(SCRIPT_RE, '').replace(SHELL_LINK_RE, '');
  var inject = '<style>' + FRAME_CSS + '</style>';
  if (/<\\/head>/i.test(cleaned)) return cleaned.replace(/<\\/head>/i, inject + '</head>');
  return inject + cleaned;
}

function parseHash() {
  var raw = location.hash.replace(/^#\\/?/, '');
  var q = raw.split('?');
  var parts = q[0].split('/').filter(Boolean);
  var params = {};
  (q[1] || '').split('&').forEach(function (kv) {
    if (!kv) return;
    var i = kv.indexOf('=');
    params[decodeURIComponent(kv.slice(0, i < 0 ? kv.length : i))] =
      decodeURIComponent(i < 0 ? '' : kv.slice(i + 1));
  });
  if (parts[0] === 'test' && parts[1]) return { view: 'test', testId: parts[1], params: params };
  return { view: 'list', params: params };
}
function buildHash(route) {
  var qs = Object.keys(route.params || {}).filter(function (k) {
    return route.params[k] !== undefined && route.params[k] !== null && route.params[k] !== '';
  }).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(route.params[k]);
  }).join('&');
  var path = route.view === 'test' ? '/test/' + encodeURIComponent(route.testId) : '/';
  return '#' + path + (qs ? '?' + qs : '');
}
function navigate(route, replace) {
  var next = buildHash(route);
  if (replace) history.replaceState(null, '', next); else location.hash = next;
  if (replace) render();
}
`;
