import { expect, test } from 'bun:test';
import { createLiveReport } from '@libs/observatory-client-ts/live-report-client';

function screenOf(document: Document) {
  document.body.innerHTML = `
    <div data-actor="alice"><p>Alice's own screen</p></div>
    <div class="themeHost" data-theme="dark" id="bob-app">
      <h1 class="text-heading">Settings</h1>
      <p>Signed in as bob@example.test</p>
      <input value="carol" data-testid="search-input" />
      <div data-sensitive="true"><p>carol_the_friend</p></div>
      <button onclick="steal()" data-testid="theme">Theme</button>
      <a href="https://elsewhere.example/">Help</a>
      <img src="https://tracker.example/pixel.png" alt="tracker" />
      <script>steal()</script>
      <div data-game-id="g-1" data-fen="8/8/8" style="width: 120px"></div>
    </div>`;
  return document.getElementById('bob-app')!;
}

async function capturedFrame(root: Element, secrets: readonly string[]) {
  const sent: unknown[] = [];
  const report = createLiveReport({
    baseUrl: 'https://api.example.test',
    fetch: async (_input, init) => {
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ kept: true });
    },
    headers: () => ({ 'content-type': 'application/json' }),
    secrets: () => secrets,
    root: () => root,
  });
  expect(await report.frame(1_000)).toBe(true);
  return sent[0] as { html: string; capturedAtMs: number };
}

test('a watched screen is only the app’s own, drawn as it looks', async () => {
  const frame = await capturedFrame(screenOf(document), []);
  expect(frame.capturedAtMs).toBe(1_000);
  expect(frame.html.startsWith('<body>')).toBe(true);
  expect(frame.html).toContain('class="themeHost"');
  expect(frame.html).toContain('data-theme="dark"');
  expect(frame.html).toContain('class="text-heading"');
  expect(frame.html).toContain('data-game-id="g-1"');
  expect(frame.html).toContain('style="width: 120px"');
  // Another app sharing the document is never part of it.
  expect(frame.html).not.toContain("Alice's own screen");
});

test('a watched screen never carries private details or anything that runs', async () => {
  const frame = await capturedFrame(screenOf(document), ['session-token-1']);
  for (const hidden of [
    'bob@example.test',
    'carol',
    'steal()',
    'onclick',
    'elsewhere.example',
    'tracker.example',
  ])
    expect(frame.html).not.toContain(hidden);
  expect(frame.html).toContain('[redacted email]');
});
