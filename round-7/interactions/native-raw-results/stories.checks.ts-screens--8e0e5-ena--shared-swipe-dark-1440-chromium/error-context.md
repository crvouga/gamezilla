# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-light-cycles-arena--shared-swipe dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  13041 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/shared-swipe-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/shared-swipe-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 13041 pixels (ratio 0.02 of all image pixels) are different.
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
  - 13041 pixels (ratio 0.02 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Light Cycles Trio" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e29]:
          - generic [ref=e30]: Comet 0Ember 0Nova 0Round 1 · first to 3
          - status [ref=e31]: You ride Comet. You ride Ember.
          - application "Light Cycles arena" [active] [ref=e32]:
            - img [ref=e33]:
              - generic [ref=e40]:
                - generic: C
              - generic [ref=e44]:
                - generic: E
              - generic [ref=e48]:
                - generic: "N"
            - generic:
              - generic: "Left: Ember"
              - generic: "Right: Comet"
            - status
          - paragraph [ref=e51]: Focus the arena. Comet uses arrow keys; Ember uses W, A, S and D. Avoid the edge and every trail.
        - status [ref=e53]:
          - generic [ref=e54]:
            - generic [ref=e55]: "Comet: avery. Ember: jordan_plays. Nova: morgan."
            - text: Round 1 · first to 3
      - region "Players" [ref=e57]:
        - generic [ref=e58]:
          - heading "Players" [level=2] [ref=e60]
          - paragraph [ref=e61]: Round 1 · first to 3
        - generic [ref=e62]:
          - generic [ref=e64]:
            - generic [ref=e69]:
              - img "Comet" [ref=e70]:
                - generic [ref=e71]: C
              - generic "avery" [ref=e74]
              - generic [ref=e77]: You
            - generic [ref=e78]: Comet wins 0
          - generic [ref=e80]:
            - generic [ref=e85]:
              - img "Ember" [ref=e86]:
                - generic [ref=e87]: E
              - generic "jordan_plays" [ref=e90]
            - generic [ref=e91]: Ember wins 0
          - generic [ref=e93]:
            - generic [ref=e98]:
              - img "Nova" [ref=e99]:
                - generic [ref=e100]: "N"
              - generic "morgan" [ref=e103]
            - generic [ref=e104]: Nova wins 0
        - generic [ref=e106]:
          - group "Game actions" [ref=e107]:
            - button "Resign game" [ref=e108] [cursor=pointer]:
              - paragraph [ref=e111]:
                - text: Resign
                - generic [ref=e112]: game
          - button "History and stats" [ref=e113] [cursor=pointer]:
            - paragraph [ref=e116]: History and stats
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