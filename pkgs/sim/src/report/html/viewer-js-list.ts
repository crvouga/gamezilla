/** Report viewer script, part 2: header + test list. */
export const VIEWER_JS_LIST = `
var FILTERS = ['all', 'passed', 'failed', 'skipped'];

function counts() {
  var c = { all: DATA.tests.length, passed: 0, failed: 0, skipped: 0 };
  DATA.tests.forEach(function (t) { c[t.report.meta.status] = (c[t.report.meta.status] || 0) + 1; });
  return c;
}
function totalDuration() {
  return DATA.tests.reduce(function (n, t) { return n + (t.report.meta.durationMs || 0); }, 0);
}

function renderHeader(root, route) {
  var c = counts();
  var chips = h('div', { class: 'chips' }, FILTERS.map(function (f) {
    var on = (route.params.status || 'all') === f;
    return h('button', {
      class: 'chip' + (on ? ' on' : ''),
      onclick: function () {
        var params = Object.assign({}, route.params, { status: f === 'all' ? '' : f });
        navigate({ view: 'list', params: params }, false);
      }
    }, [f.charAt(0).toUpperCase() + f.slice(1) + ' ', h('b', { text: String(c[f] || 0) })]);
  }));
  var search = h('input', {
    class: 'search', type: 'search', placeholder: 'Filter tests…',
    value: route.params.q || '',
    oninput: function (e) {
      var params = Object.assign({}, route.params, { q: e.target.value });
      history.replaceState(null, '', buildHash({ view: 'list', params: params }));
      renderList(document.getElementById('content'), { view: 'list', params: params });
    }
  });
  root.appendChild(h('header', { class: 'header' }, [
    h('a', { href: '#/' }, [h('h1', { text: DATA.title })]),
    h('span', { class: 'meta' }, [
      h('span', { class: 'dot ' + DATA.status }), ' ', DATA.runId,
      DATA.updatedAtMs ? ' · ' + fmtDate(DATA.updatedAtMs) : '',
      ' · ' + fmtMs(totalDuration())
    ]),
    h('span', { class: 'spacer' }),
    route.view === 'list' ? chips : null,
    route.view === 'list' ? search : null
  ]));
}

function matchesFilter(t, route) {
  var status = route.params.status;
  if (status && t.report.meta.status !== status) return false;
  var q = (route.params.q || '').trim().toLowerCase();
  if (!q) return true;
  var m = t.report.meta;
  return [m.title, m.testId, m.sourceFile || '', m.system, m.runtime]
    .join(' ').toLowerCase().indexOf(q) >= 0;
}

function renderList(root, route) {
  clear(root);
  var list = h('div', { class: 'list' });
  var shown = DATA.tests.filter(function (t) { return matchesFilter(t, route); });
  if (shown.length === 0) {
    list.appendChild(h('div', { class: 'empty', text: DATA.tests.length === 0 ? 'No tests were reported.' : 'No tests match.' }));
  }
  shown.forEach(function (t) {
    var m = t.report.meta;
    list.appendChild(h('div', {
      class: 'row',
      onclick: function () { navigate({ view: 'test', testId: m.testId, params: {} }, false); }
    }, [
      h('span', { class: 'dot ' + m.status }),
      h('div', {}, [
        h('div', { class: 'title', text: m.title }),
        h('div', { class: 'sub' }, [
          m.sourceFile ? h('span', { class: 'mono', text: m.sourceFile + (m.sourceLine ? ':' + m.sourceLine : '') }) : h('span', { class: 'mono', text: m.testId }),
          m.error ? h('span', { text: ' · ' + m.error.split('\\n')[0] }) : null
        ])
      ]),
      h('span', { class: 'badge', text: m.runtime + ' · seed ' + m.seed }),
      h('span', { class: 'dur', text: fmtMs(m.durationMs) })
    ]));
  });
  root.appendChild(list);
}
`;
