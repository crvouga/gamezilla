# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-light-cycles-arena--duel-steering light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  3581 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/duel-steering-light.png

Call log:
  - Expect "toHaveScreenshot(libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/duel-steering-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 3581 pixels (ratio 0.02 of all image pixels) are different.
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
  - 3581 pixels (ratio 0.02 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Light Cycles Duel" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e22]:
      - generic [ref=e24]:
        - generic [ref=e26]:
          - generic [ref=e31]:
            - img "Ember" [ref=e32]:
              - generic [ref=e33]: E
            - generic "jordan_plays" [ref=e36]
          - generic [ref=e37]:
            - generic [ref=e38]: Ember wins
            - generic [ref=e39]: "0"
        - generic [ref=e41]:
          - generic [ref=e42]: Comet 0Ember 0Round 1 · first to 3
          - status [ref=e43]: You ride Comet.
          - application "Light Cycles arena" [active] [ref=e44]:
            - img [ref=e45]:
              - generic [ref=e51]:
                - generic: C
              - generic [ref=e55]:
                - generic: E
            - status
          - group [ref=e60]:
            - button "Steer Comet up" [ref=e61] [cursor=pointer]:
              - img [ref=e62]
            - button "Steer Comet left" [ref=e64] [cursor=pointer]:
              - img [ref=e65]
            - button "Steer Comet down" [ref=e67] [cursor=pointer]:
              - img [ref=e68]
            - button "Steer Comet right" [ref=e70] [cursor=pointer]:
              - img [ref=e71]
          - paragraph [ref=e73]: Swipe the arena or use the pad to steer. Avoid the edge and every trail.
        - status [ref=e77]:
          - generic [ref=e78]:
            - generic [ref=e79]: "Comet: avery. Ember: jordan_plays."
            - text: Round 1 · first to 3
        - generic [ref=e82]:
          - generic [ref=e87]:
            - img "Comet" [ref=e88]:
              - generic [ref=e89]: C
            - generic "avery" [ref=e92]
          - generic [ref=e93]:
            - generic [ref=e94]: Comet wins
            - generic [ref=e95]: "0"
      - generic [ref=e98]:
        - group "Game actions" [ref=e99]:
          - button "Resign game" [ref=e100] [cursor=pointer]:
            - paragraph [ref=e103]:
              - text: Resign
              - generic [ref=e104]: game
        - button "History and stats" [ref=e105] [cursor=pointer]:
          - generic [ref=e107]:
            - paragraph [ref=e108]: History and stats
            - img [ref=e111]
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