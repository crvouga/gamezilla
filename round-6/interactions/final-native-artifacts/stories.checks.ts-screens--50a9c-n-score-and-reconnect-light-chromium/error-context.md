# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-pong-court--return-score-and-reconnect light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  32004 pixels (ratio 0.10 of all image pixels) are different.

  Snapshot: libs/pong-client-ts/src/baselines/chromium/screens-games-pong-court/return-score-and-reconnect-light.png

Call log:
  - Expect "toHaveScreenshot(libs/pong-client-ts/src/baselines/chromium/screens-games-pong-court/return-score-and-reconnect-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 32004 pixels (ratio 0.10 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - 32004 pixels (ratio 0.10 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - generic [ref=e13]:
      - generic [ref=e14]:
        - heading "Pong" [level=1] [ref=e17]
        - generic [ref=e19]:
          - generic [ref=e20]: Unrated
          - generic [ref=e21]: ·Untimed
      - generic [ref=e23]:
        - generic [ref=e25]:
          - generic [ref=e27]:
            - generic [ref=e28]: Left 1 Right 0
            - generic [ref=e29]:
              - generic [ref=e30]:
                - generic [ref=e31]:
                  - generic [ref=e32]: "1"
                  - generic [ref=e33]: You
                - generic [ref=e34]:
                  - generic [ref=e35]: "0"
                  - generic [ref=e36]: jordan_plays
              - generic [ref=e37]:
                - application "Pong court" [ref=e38]:
                  - img [ref=e39]
                  - status: Serve in 1.
                  - generic: ↕ Drag
                - generic:
                  - slider "Left paddle": "500"
            - paragraph [ref=e45]: First to 3 · Drag up and down along your edge of the court.
          - generic [ref=e46]:
            - status:
              - generic [ref=e47]: "Left: avery. Right: jordan_plays."
        - generic [ref=e50]:
          - group "Game actions" [ref=e51]:
            - button "Resign game" [ref=e52] [cursor=pointer]:
              - paragraph [ref=e55]:
                - text: Resign
                - generic [ref=e56]: game
          - button "History and stats" [ref=e57] [cursor=pointer]:
            - generic [ref=e59]:
              - paragraph [ref=e60]: History and stats
              - img [ref=e63]
    - generic [ref=e65]: 1 returns
    - generic [ref=e66]: 1 points
    - button "Advance three seconds" [ref=e67] [cursor=pointer]:
      - paragraph [ref=e70]: Advance three seconds
    - button "Disconnect" [ref=e71] [cursor=pointer]:
      - paragraph [ref=e74]: Disconnect
```

# Test source

```ts
  1  | // @io-wall-ok — browser verification adapter; all requests stay on the static server.
  2  | import { expect, type Page } from '@playwright/test';
  3  | import axe from 'axe-core';
  4  | import type { visualScenarios } from '../../storybook/scenarios';
  5  | 
  6  | /** The same readiness, accessibility and pixel contract for every canvas. */
  7  | export async function verifyStoryScenario(
  8  |   page: Page,
  9  |   storyId: string,
  10 |   scenario: ReturnType<typeof visualScenarios>[number]
  11 | ): Promise<void> {
  12 |   const { width, height, theme } = scenario;
  13 |   await page.setViewportSize({ width, height });
  14 |   const failures: string[] = [];
  15 |   page.on('pageerror', (error) => failures.push(error.message));
  16 |   await page.route('**/*', (route) =>
  17 |     new URL(route.request().url()).hostname === '127.0.0.1'
  18 |       ? route.continue()
  19 |       : route.abort()
  20 |   );
  21 |   await page.goto(
  22 |     `/iframe.html?id=${storyId}&viewMode=story&globals=theme:${theme}`
  23 |   );
  24 |   await expect
  25 |     .poll(async () =>
  26 |       page.locator('#storybook-root').evaluate((root) => {
  27 |         const status = root.getAttribute('data-story-status');
  28 |         if (status === 'error')
  29 |           return `error: ${root.getAttribute('data-story-error') ?? 'Storybook reported a failure'}`;
  30 |         return root.getAttribute('data-story-ready') === 'true'
  31 |           ? 'success'
  32 |           : 'pending';
  33 |       })
  34 |     )
  35 |     .toBe('success');
  36 |   await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  37 |   await page.evaluate(() => document.fonts.ready);
  38 |   await page.addScriptTag({ content: axe.source });
  39 |   const violations = await page.evaluate(async () => {
  40 |     const root = document.querySelector<HTMLElement>('#storybook-root');
  41 |     if (!root) throw new Error('Storybook canvas is missing');
  42 |     const result = await (window as unknown as { axe: typeof axe }).axe.run(
  43 |       root
  44 |     );
  45 |     return result.violations.filter(
  46 |       (v) => v.impact === 'serious' || v.impact === 'critical'
  47 |     );
  48 |   });
  49 |   expect(violations).toEqual([]);
  50 |   expect(failures).toEqual([]);
> 51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
     |                                                 ^ Error: expect(locator).toHaveScreenshot(expected) failed
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```