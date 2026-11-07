# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-light-cycles-arena--round-over light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  38968 pixels (ratio 0.12 of all image pixels) are different.

  Snapshot: libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/round-over-light.png

Call log:
  - Expect "toHaveScreenshot(libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/round-over-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 38968 pixels (ratio 0.12 of all image pixels) are different.
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
  - 38968 pixels (ratio 0.12 of all image pixels) are different.

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
                  - generic [ref=e38]: Out
                  - generic [ref=e40]: You
          - generic "jordan_plays" [ref=e41]:
            - listitem [ref=e42]:
              - generic [ref=e44]:
                - generic [ref=e45]: jordan_plays
                - generic [ref=e46]:
                  - generic [ref=e48]: E
                  - generic [ref=e49]: Ember wins 1
          - generic "morgan" [ref=e50]:
            - listitem [ref=e51]:
              - generic [ref=e53]:
                - generic [ref=e54]: morgan
                - generic [ref=e55]:
                  - generic [ref=e57]: "N"
                  - generic [ref=e58]: Nova wins 0
                  - generic [ref=e60]: Out
        - generic [ref=e62]:
          - generic [ref=e63]: Comet 0Ember 1Nova 0Round 1 · first to 3
          - status [ref=e64]: Ember wins the round. Next round soon.
          - application "Light Cycles arena" [ref=e65]:
            - img [ref=e66]:
              - generic [ref=e73]:
                - generic: C
              - generic [ref=e76]:
                - generic: E
              - generic [ref=e79]:
                - generic: "N"
            - status
        - status [ref=e90]:
          - generic [ref=e91]:
            - generic [ref=e92]: "Comet: avery. Ember: jordan_plays. Nova: morgan."
            - text: Round 1 · first to 3
      - generic [ref=e95]:
        - group "Game actions" [ref=e96]:
          - button "Resign game" [ref=e97] [cursor=pointer]:
            - paragraph [ref=e100]:
              - text: Resign
              - generic [ref=e101]: game
        - button "History and stats" [ref=e102] [cursor=pointer]:
          - generic [ref=e104]:
            - paragraph [ref=e105]: History and stats
            - img [ref=e108]
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