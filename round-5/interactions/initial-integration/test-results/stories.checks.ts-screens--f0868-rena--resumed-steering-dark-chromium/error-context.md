# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-light-cycles-arena--resumed-steering dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  16771 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/resumed-steering-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/resumed-steering-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 16771 pixels (ratio 0.06 of all image pixels) are different.
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
  - 16771 pixels (ratio 0.06 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Light Cycles Trio" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e22]:
      - generic [ref=e24]:
        - list "Players" [ref=e26]:
          - generic "avery" [ref=e27]:
            - listitem [ref=e28]:
              - generic [ref=e31]:
                - generic [ref=e32]: avery
                - generic [ref=e33]:
                  - generic [ref=e35]: C
                  - generic [ref=e36]: Comet wins 0
                  - generic [ref=e38]: You
          - generic "jordan_plays" [ref=e39]:
            - listitem [ref=e40]:
              - generic [ref=e42]:
                - generic [ref=e43]: jordan_plays
                - generic [ref=e44]:
                  - generic [ref=e46]: E
                  - generic [ref=e47]: Ember wins 0
          - generic "morgan" [ref=e48]:
            - listitem [ref=e49]:
              - generic [ref=e51]:
                - generic [ref=e52]: morgan
                - generic [ref=e53]:
                  - generic [ref=e55]: "N"
                  - generic [ref=e56]: Nova wins 0
        - generic [ref=e58]:
          - generic [ref=e59]: Comet 0Ember 0Nova 0Round 1 · first to 3
          - status [ref=e60]: You ride Comet.
          - application "Light Cycles arena" [active] [ref=e61]:
            - img [ref=e62]:
              - generic [ref=e69]:
                - generic: C
              - generic [ref=e73]:
                - generic: E
              - generic [ref=e76]:
                - generic: "N"
            - status
          - group [ref=e81]:
            - button "Steer Comet up" [ref=e82] [cursor=pointer]:
              - img [ref=e83]
            - button "Steer Comet left" [ref=e85] [cursor=pointer]:
              - img [ref=e86]
            - button "Steer Comet down" [ref=e88] [cursor=pointer]:
              - img [ref=e89]
            - button "Steer Comet right" [ref=e91] [cursor=pointer]:
              - img [ref=e92]
          - paragraph [ref=e94]: Swipe the arena or use the pad to steer. Avoid the edge and every trail.
        - status [ref=e98]:
          - generic [ref=e99]:
            - generic [ref=e100]: "Comet: avery. Ember: jordan_plays. Nova: morgan."
            - text: Round 1 · first to 3
      - generic [ref=e103]:
        - group "Game actions" [ref=e104]:
          - button "Resign game" [ref=e105] [cursor=pointer]:
            - paragraph [ref=e108]:
              - text: Resign
              - generic [ref=e109]: game
        - button "History and stats" [ref=e110] [cursor=pointer]:
          - generic [ref=e112]:
            - paragraph [ref=e113]: History and stats
            - img [ref=e116]
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