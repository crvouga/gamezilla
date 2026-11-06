#!/usr/bin/env node
// capture-stories: screenshot Storybook stories and compose readable before/after images.
//
// Shared, byte for byte, by the ui-overhaul and ui-ux-overhaul skills. Node 18+ and the
// target repository's own Playwright (`playwright`, `playwright-core` or `@playwright/test`).
//
//   capture  --storybook <url|static-dir> --stories a,b|--stories-file f --out DIR
//            [--viewports phone=390x844,desktop=1440x900] [--themes dark,light]
//            [--theme-global theme] [--globals 'k:v;k2:v2'] [--ready-selector css]
//            [--wait-ms 200] [--viewport-only]
//   compose  --before DIR --after DIR --out DIR [--before-label ..] [--after-label ..]
//            [--max-width 900]
//   journey  --goal "..." --before-frames a.png,b.png --after-frames x.png --out f.png
//            [--before-label ..] [--after-label ..] [--max-width 420]
//
// Common: [--resolve-from DIR] where Playwright is installed (default: cwd),
//         [--browser-path PATH] a Chromium executable (default: Playwright's own).
//
// Files are named <story-id>--<viewport>[--<theme>].png so a before set and an after
// set captured with the same flags pair up by name.

import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { basename, extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const [cmd, ...rest] = process.argv.slice(2);
const opts = {};
for (let i = 0; i < rest.length; i++) {
  const key = rest[i];
  if (!key.startsWith('--')) fail(`unexpected argument ${key}`);
  const next = rest[i + 1];
  if (next === undefined || next.startsWith('--')) opts[key.slice(2)] = true;
  else (opts[key.slice(2)] = next), i++;
}

function fail(message) {
  console.error(`capture-stories: ${message}`);
  process.exit(2);
}

function list(value) {
  return typeof value === 'string'
    ? value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

async function loadChromium() {
  const from = resolve(opts['resolve-from'] ?? process.cwd());
  const require = createRequire(join(from, 'noop.js'));
  for (const name of ['playwright', 'playwright-core', '@playwright/test']) {
    try {
      const mod = await import(pathToFileURL(require.resolve(name)).href);
      return mod.chromium ?? mod.default?.chromium;
    } catch {}
  }
  fail(
    `no playwright, playwright-core or @playwright/test resolvable from ${from}; pass --resolve-from <dir with node_modules>`
  );
}

async function launch() {
  const chromium = await loadChromium();
  return chromium.launch(
    opts['browser-path'] ? { executablePath: opts['browser-path'] } : {}
  );
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

function serveStatic(root) {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const path = resolve(
        root,
        `.${decodeURIComponent(new URL(req.url, 'http://x').pathname)}`
      );
      const file = path === root ? join(root, 'index.html') : path;
      if (file !== root && !file.startsWith(root + sep))
        return res.writeHead(403).end();
      if (!existsSync(file) || !statSync(file).isFile())
        return res.writeHead(404).end();
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () =>
      done({ server, url: `http://127.0.0.1:${server.address().port}` })
    );
  });
}

async function storyIndex(base) {
  for (const path of ['index.json', 'stories.json']) {
    try {
      const res = await fetch(`${base}/${path}`);
      if (res.ok) {
        const data = await res.json();
        return new Set(Object.keys(data.entries ?? data.stories ?? {}));
      }
    } catch {}
  }
  return null;
}

function captureArgs() {
  if (!opts.storybook || !opts.out) fail('capture needs --storybook and --out');
  let stories = list(opts.stories);
  if (opts['stories-file'])
    stories = stories.concat(
      readFileSync(opts['stories-file'], 'utf8')
        .split(/\s+/)
        .filter((s) => s && !s.startsWith('#'))
    );
  if (!stories.length) fail('no stories given (--stories or --stories-file)');
  const viewports = list(
    opts.viewports ?? 'phone=390x844,desktop=1440x900'
  ).map((v) => {
    const m = /^([a-z0-9-]+)=(\d+)x(\d+)$/i.exec(v);
    if (!m) fail(`bad viewport ${v}; use name=WIDTHxHEIGHT`);
    return { name: m[1], width: +m[2], height: +m[3] };
  });
  return {
    stories,
    viewports,
    themes: list(opts.themes),
    themeKey: opts['theme-global'] ?? 'theme',
    extra: typeof opts.globals === 'string' ? opts.globals : '',
    waitMs: Number(opts['wait-ms'] ?? 200),
    out: resolve(opts.out),
  };
}

async function openStorybook(stories) {
  let base = String(opts.storybook).replace(/\/$/, '');
  let server;
  if (!/^https?:/.test(base)) {
    const root = resolve(base);
    if (!existsSync(join(root, 'iframe.html')))
      fail(`${root} is not a static Storybook build (no iframe.html)`);
    ({ server, url: base } = await serveStatic(root));
  }
  const known = await storyIndex(base);
  const unknown = known ? stories.filter((s) => !known.has(s)) : [];
  if (unknown.length) fail(`unknown story ids: ${unknown.join(', ')}`);
  return { base, server };
}

function storyState() {
  if (document.body.classList.contains('sb-show-errordisplay')) return 'error';
  return document.body.classList.contains('sb-show-main') ? 'ok' : false;
}

// One screenshot. Returns the written entry, or an error string.
async function shoot(page, a, base, shot) {
  const { id, vp, theme } = shot;
  const globals = [theme ? `${a.themeKey}:${theme}` : '', a.extra]
    .filter(Boolean)
    .join(';');
  const url = `${base}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story${globals ? `&globals=${globals}` : ''}`;
  await page.setViewportSize({ width: vp.width, height: vp.height });
  if (theme)
    await page.emulateMedia({
      colorScheme: theme === 'light' ? 'light' : 'dark',
    });
  await page.goto(url, { waitUntil: 'load' });
  const state = await page
    .waitForFunction(storyState, null, { timeout: 60_000 })
    .then((h) => h.jsonValue())
    .catch(() => 'timeout');
  if (state !== 'ok')
    return `${id} @ ${vp.name}${theme ? '/' + theme : ''}: story ${state}`;
  if (typeof opts['ready-selector'] === 'string')
    await page.waitForSelector(opts['ready-selector'], { timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(a.waitMs);
  const file = `${id}--${vp.name}${theme ? `--${theme}` : ''}.png`;
  await page.screenshot({
    path: join(a.out, file),
    fullPage: !opts['viewport-only'],
    animations: 'disabled',
  });
  return {
    file,
    story: id,
    viewport: vp,
    theme,
    url: url.replace(base, '<storybook>'),
  };
}

async function capture() {
  const a = captureArgs();
  mkdirSync(a.out, { recursive: true });
  const { base, server } = await openStorybook(a.stories);
  const browser = await launch();
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme:
      a.themes.length === 1 && a.themes[0] === 'light' ? 'light' : 'dark',
  });
  const page = await context.newPage();
  const written = [];
  const errors = [];
  for (const id of a.stories) {
    for (const vp of a.viewports)
      for (const theme of a.themes.length ? a.themes : [null]) {
        const result = await shoot(page, a, base, { id, vp, theme });
        if (typeof result === 'string') errors.push(result);
        else written.push(result);
      }
    console.log(`captured ${id}`);
  }
  const { stories, viewports, themes, extra } = a;
  writeFileSync(
    join(a.out, 'capture.json'),
    JSON.stringify(
      { stories, viewports, themes, globals: extra, files: written },
      null,
      2
    ) + '\n'
  );
  await browser.close();
  server?.close();
  if (errors.length)
    fail(`some stories did not render:\n  ${errors.join('\n  ')}`);
  console.log(`${written.length} screenshots in ${a.out}`);
}

function dataUrl(file) {
  return `data:image/png;base64,${readFileSync(file).toString('base64')}`;
}

function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
  );
}

const CSS = `body{margin:0;background:#1d1f24;color:#eceef2;font:15px/1.4 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;display:inline-block}
.wrap{padding:20px;display:inline-flex;flex-direction:column;gap:14px}h1{font-size:17px;margin:0}
.row{display:flex;gap:20px;align-items:flex-start}.col{display:flex;flex-direction:column;gap:8px}
.tag{font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#aeb4c0}
.tag b{color:#eceef2}img{display:block;border:1px solid #3a3e47}.none{border:1px dashed #555b66;color:#aeb4c0;padding:24px;font-size:13px;min-width:260px;box-sizing:border-box}
.strip{display:flex;gap:12px;align-items:flex-start}.step{display:flex;flex-direction:column;gap:6px}.n{font-size:12px;color:#aeb4c0}`;

async function render(page, html, file) {
  await page.setViewportSize({ width: 400, height: 300 });
  await page.setContent(
    `<!doctype html><meta charset=utf-8><style>${CSS}</style>${html}`,
    { waitUntil: 'load' }
  );
  const size = await page.evaluate(() => ({
    w: Math.ceil(document.querySelector('.wrap').getBoundingClientRect().width),
    h: Math.ceil(
      document.querySelector('.wrap').getBoundingClientRect().height
    ),
  }));
  await page.setViewportSize({
    width: size.w,
    height: Math.min(size.h, 16000),
  });
  await page.screenshot({ path: file, fullPage: true });
}

function sized(file, maxWidth) {
  const buf = readFileSync(file);
  const width = buf.readUInt32BE(16);
  const scale = width > maxWidth ? maxWidth / width : 1;
  return {
    src: dataUrl(file),
    width: Math.round(width * scale),
    note: scale < 1 ? ` (${Math.round(scale * 100)}%)` : '',
  };
}

async function compose() {
  if (!opts.before || !opts.after || !opts.out)
    fail('compose needs --before, --after and --out');
  const before = resolve(opts.before),
    after = resolve(opts.after),
    out = resolve(opts.out);
  mkdirSync(out, { recursive: true });
  const maxWidth = Number(opts['max-width'] ?? 900);
  const pngs = (dir) =>
    existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')) : [];
  const names = [...new Set([...pngs(before), ...pngs(after)])].sort();
  const browser = await launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const name of names) {
    const side = (dir, label) => {
      const file = join(dir, name);
      if (!existsSync(file))
        return `<div class=col><div class=tag>${esc(label)}</div><div class=none>${dir === before ? 'Absent from round-4 capture' : 'Absent from round-5 capture'}</div></div>`;
      const img = sized(file, maxWidth);
      return `<div class=col><div class=tag>${esc(label)}${esc(img.note)}</div><img src="${img.src}" width=${img.width}></div>`;
    };
    const html = `<div class=wrap><h1>${esc(basename(name, '.png'))}</h1><div class=row>${side(before, opts['before-label'] ?? 'Before')}${side(after, opts['after-label'] ?? 'After')}</div></div>`;
    await render(page, html, join(out, name));
    console.log(`paired ${name}`);
  }
  await browser.close();
  console.log(`${names.length} comparisons in ${out}`);
}

async function journey() {
  if (!opts.goal || !opts.out) fail('journey needs --goal and --out');
  const maxWidth = Number(opts['max-width'] ?? 420);
  const row = (label, frames) => {
    const steps = frames
      .map((f, i) => {
        if (!existsSync(f)) fail(`missing frame ${f}`);
        const img = sized(f, maxWidth);
        return `<div class=step><div class=n>Step ${i + 1}${esc(img.note)} · ${esc(basename(f, '.png'))}</div><img src="${img.src}" width=${img.width}></div>`;
      })
      .join('');
    return `<div class=col><div class=tag><b>${esc(label)}</b> · ${frames.length} step${frames.length === 1 ? '' : 's'}</div><div class=strip>${steps || '<div class=none>No steps</div>'}</div></div>`;
  };
  const html = `<div class=wrap><h1>Goal: ${esc(opts.goal)}</h1>${row(opts['before-label'] ?? 'Before', list(opts['before-frames']))}${row(opts['after-label'] ?? 'After', list(opts['after-frames']))}</div>`;
  const browser = await launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  mkdirSync(resolve(opts.out, '..'), { recursive: true });
  await render(page, html, resolve(opts.out));
  await browser.close();
  console.log(`journey comparison written to ${opts.out}`);
}

const commands = { capture, compose, journey };
if (!commands[cmd])
  fail(
    `usage: capture-stories <${Object.keys(commands).join('|')}> [flags]; see the header of this file`
  );
await commands[cmd]();
