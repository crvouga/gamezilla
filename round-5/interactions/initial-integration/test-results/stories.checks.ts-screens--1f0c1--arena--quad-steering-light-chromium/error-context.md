# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-light-cycles-arena--quad-steering light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  28198 pixels (ratio 0.09 of all image pixels) are different.

  Snapshot: libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/quad-steering-light.png

Call log:
  - Expect "toHaveScreenshot(libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/quad-steering-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 28198 pixels (ratio 0.09 of all image pixels) are different.
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
  - 28198 pixels (ratio 0.09 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Light Cycles Quad" [level=1] [ref=e16]
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
          - generic "robin_42" [ref=e57]:
            - listitem [ref=e58]:
              - generic [ref=e60]:
                - generic [ref=e61]: robin_42
                - generic [ref=e62]:
                  - generic [ref=e64]: V
                  - generic [ref=e65]: Volt wins 0
        - generic [ref=e67]:
          - generic [ref=e68]: Comet 0Ember 0Nova 0Volt 0Round 1 · first to 3
          - status [ref=e69]: You ride Comet.
          - application "Light Cycles arena" [active] [ref=e70]:
            - img [ref=e71]:
              - generic [ref=e79]:
                - generic: C
              - generic [ref=e83]:
                - generic: E
              - generic [ref=e86]:
                - generic: "N"
              - generic [ref=e89]:
                - generic: V
            - status
          - group [ref=e94]:
            - button "Steer Comet up" [ref=e95] [cursor=pointer]:
              - img [ref=e96]
            - button "Steer Comet left" [ref=e98] [cursor=pointer]:
              - img [ref=e99]
            - button "Steer Comet down" [ref=e101] [cursor=pointer]:
              - img [ref=e102]
            - button "Steer Comet right" [ref=e104] [cursor=pointer]:
              - img [ref=e105]
          - paragraph [ref=e107]: Swipe the arena or use the pad to steer. Avoid the edge and every trail.
        - status [ref=e111]:
          - generic [ref=e112]:
            - generic [ref=e113]: "Comet: avery. Ember: jordan_plays. Nova: morgan. Volt: robin_42."
            - text: Round 1 · first to 3
      - generic [ref=e116]:
        - group "Game actions" [ref=e117]:
          - button "Resign game" [ref=e118] [cursor=pointer]:
            - paragraph [ref=e121]:
              - text: Resign
              - generic [ref=e122]: game
        - button "History and stats" [ref=e123] [cursor=pointer]:
          - generic [ref=e125]:
            - paragraph [ref=e126]: History and stats
            - img [ref=e129]
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