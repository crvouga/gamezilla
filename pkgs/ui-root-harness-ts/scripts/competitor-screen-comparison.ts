// @io-wall-ok — comparison image composition root
/**
 * Side-by-side comparison of each competitor screenshot with the Storybook
 * story named for it in `storybook/competitor-screens.ts`.
 *
 * Writes one PNG per pair, plus `comparison.md`, under
 * `pkgs/ui-root-harness-ts/.cache/competitor-screen-comparison/`.
 * That directory is gitignored. Attach the PNGs to a pull request comment
 * (`gh pr comment --attach`); do not commit them.
 *
 * Needs Storybook. Uses one already running on `STORYBOOK_PORT` (6006),
 * otherwise starts `storybook dev` for the run and stops it after.
 *
 *   bun pkgs/ui-root-harness-ts/scripts/competitor-screen-comparison.ts
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { storybookNetwork } from '../storybook/network';
import {
  COMPARISON_VIEWPORT,
  COMPETITOR_CATALOG,
  competitorScreens,
} from '../storybook/competitor-screens';

const repoRoot = resolve(import.meta.dirname, '../../..');
const harness = join(repoRoot, 'pkgs/ui-root-harness-ts');
const outDir = join(harness, '.cache/competitor-screen-comparison');
const LABEL_HEIGHT = 36;
const GAP = 16;
const PADDING = 16;
const PANEL = COMPARISON_VIEWPORT.width;
const BACKGROUND = { r: 24, g: 24, b: 27, alpha: 1 };

type Shot = { readonly buffer: Buffer; readonly width: number; readonly height: number };

function fit(shot: Shot, height: number): Promise<Buffer> {
  return sharp(shot.buffer)
    .resize(PANEL, height, {
      fit: 'contain',
      background: BACKGROUND,
    })
    .png()
    .toBuffer();
}

function label(text: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL}" height="${LABEL_HEIGHT}">
    <text x="0" y="24" fill="#f4f4f5" font-family="sans-serif" font-size="16">${text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function compose(
  ours: Shot,
  theirs: Shot,
  ourLabel: string,
  theirLabel: string
): Promise<Buffer> {
  const height = Math.max(ours.height, theirs.height, 1);
  const [ourPanel, theirPanel, ourCaption, theirCaption] = await Promise.all([
    fit(ours, height),
    fit(theirs, height),
    label(ourLabel),
    label(theirLabel),
  ]);
  const width = PADDING * 2 + PANEL * 2 + GAP;
  const canvasHeight = PADDING * 2 + LABEL_HEIGHT + height;
  return sharp({
    create: {
      width,
      height: canvasHeight,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([
      { input: ourCaption, left: PADDING, top: PADDING },
      { input: theirCaption, left: PADDING + PANEL + GAP, top: PADDING },
      { input: ourPanel, left: PADDING, top: PADDING + LABEL_HEIGHT },
      {
        input: theirPanel,
        left: PADDING + PANEL + GAP,
        top: PADDING + LABEL_HEIGHT,
      },
    ])
    .png()
    .toBuffer();
}

async function waitForStorybook(url: string): Promise<void> {
  const deadline = Date.now() + 180_000;
  let last = 'no response';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/iframe.html`);
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`Storybook did not answer at ${url}: ${last}`);
}

function storybookAlreadyRunning(): boolean {
  const manifestPath = join(harness, '.cache/storybook-dev.json');
  if (!existsSync(manifestPath)) return false;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    pid: number;
    status: string;
  };
  if (manifest.status === 'stopped') return false;
  try {
    process.kill(manifest.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function storybookCli(): string {
  const root = resolve(import.meta.dirname, '../../..');
  const linked = join(root, 'node_modules/.bun');
  const entries = existsSync(linked)
    ? readdirSync(linked).filter((name) => name.startsWith('storybook@'))
    : [];
  const installed = entries
    .map((name) =>
      join(linked, name, 'node_modules/storybook/package.json')
    )
    .find((path) => existsSync(path));
  if (!installed)
    throw new Error(
      'Storybook is not installed. Run bun install from the repository root.'
    );
  const require = createRequire(installed);
  return join(
    dirname(require.resolve('storybook/package.json')),
    'dist/bin/dispatcher.js'
  );
}

function startStorybook(): ChildProcess {
  const network = storybookNetwork(process.env);
  return spawn(
    process.execPath,
    [
      storybookCli(),
      'dev',
      '--ci',
      '--no-open',
      '--exact-port',
      '-c',
      'storybook',
      '--host',
      network.host,
      '-p',
      String(network.port),
    ],
    { cwd: harness, stdio: 'inherit' }
  );
}

async function captureStory(
  page: import('@playwright/test').Page,
  baseUrl: string,
  storyId: string
): Promise<Shot> {
  {
    const url = `${baseUrl}/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story`;
    const failed = await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (failed && !failed.ok())
      throw new Error(`${storyId} returned HTTP ${failed.status()}`);
    const root = page.locator('#storybook-root');
    await root.waitFor({ state: 'attached', timeout: 60_000 });
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('#storybook-root');
        return (
          canvas?.getAttribute('data-story-ready') === 'true' ||
          canvas?.getAttribute('data-story-status') === 'error'
        );
      },
      undefined,
      { timeout: 60_000 }
    );
    const status = await root.getAttribute('data-story-status');
    if (status === 'error') {
      const detail = await root.getAttribute('data-story-error');
      const body = (await page.locator('body').innerText()).slice(0, 400);
      throw new Error(
        `${storyId} failed to render${detail ? `: ${detail}` : ''}\n${body}`
      );
    }
    const buffer = await page.screenshot({ type: 'png' });
    return {
      buffer,
      width: COMPARISON_VIEWPORT.width,
      height: COMPARISON_VIEWPORT.height,
    };
  }
}

async function readScreenshot(file: string): Promise<Shot> {
  const path = join(repoRoot, COMPETITOR_CATALOG, file);
  if (!existsSync(path))
    throw new Error(`Missing competitor screenshot ${COMPETITOR_CATALOG}/${file}`);
  const image = sharp(path);
  const meta = await image.metadata();
  return {
    buffer: await image.png().toBuffer(),
    width: meta.width ?? PANEL,
    height: meta.height ?? COMPARISON_VIEWPORT.height,
  };
}

async function main(): Promise<void> {
  const seen = new Set<string>();
  for (const screen of competitorScreens) {
    if (seen.has(screen.screenshot))
      throw new Error(`Duplicate screenshot ${screen.screenshot}`);
    seen.add(screen.screenshot);
    if (!screen.story.includes('--'))
      throw new Error(`${screen.story} is not a story id`);
  }
  const network = storybookNetwork(process.env);
  const baseUrl = `http://${network.host}:${network.port}`;
  const owned = !storybookAlreadyRunning();
  const child = owned ? startStorybook() : null;
  try {
    await waitForStorybook(baseUrl);
    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: {
        width: COMPARISON_VIEWPORT.width,
        height: COMPARISON_VIEWPORT.height,
      },
      deviceScaleFactor: 1,
    });
    try {
    // The first story compiles its preview. Open it once so a cold bundle
    // does not land in the comparison.
    const first = competitorScreens[0];
    if (first) await captureStory(page, baseUrl, first.story);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    const lines = [
      '# Competitor screen comparison',
      '',
      'Ours on the left, the competitor on the right. Generated from `pkgs/ui-root-harness-ts/storybook/competitor-screens.ts`.',
      '',
    ];
    for (const screen of competitorScreens) {
      const stem = screen.screenshot.replace(/\.png$/i, '');
      const file = `${stem}.png`;
      process.stdout.write(`${screen.label}\n`);
      const [ours, theirs] = await Promise.all([
        captureStory(page, baseUrl, screen.story),
        readScreenshot(screen.screenshot),
      ]);
      const png = await compose(
        ours,
        theirs,
        'Ours',
        screen.label
      );
      writeFileSync(join(outDir, file), png);
      lines.push(
        `## ${screen.label}`,
        '',
        `${screen.storyTitle} (\`${screen.story}\`)`,
        '',
        `![${screen.label}: ours beside ${screen.label}](./${file})`,
        ''
      );
    }
    writeFileSync(join(outDir, 'comparison.md'), lines.join('\n'));
    process.stdout.write(`${outDir}\n`);
    } finally {
      await browser.close();
    }
  } finally {
    if (child && !child.killed) {
      child.kill('SIGTERM');
      await new Promise((resolveExit) => child.once('exit', resolveExit));
    }
  }
}

await main();
