# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-light-cycles-arena--quad-steering light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  9446 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/quad-steering-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/quad-steering-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 9446 pixels (ratio 0.01 of all image pixels) are different.
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
  - 9446 pixels (ratio 0.01 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Light Cycles Quad" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e29]:
          - generic [ref=e30]: Comet 0Ember 0Nova 0Volt 0Round 1 · first to 3
          - status [ref=e31]: You ride Comet.
          - application "Light Cycles arena" [active] [ref=e32]:
            - img [ref=e33]:
              - generic [ref=e41]:
                - generic: C
              - generic [ref=e45]:
                - generic: E
              - generic [ref=e48]:
                - generic: "N"
              - generic [ref=e51]:
                - generic: V
            - status
          - paragraph [ref=e54]: Steer with the arrow keys or W, A, S and D. Avoid the edge and every trail.
        - status [ref=e56]:
          - generic [ref=e57]:
            - generic [ref=e58]: "Comet: avery. Ember: jordan_plays. Nova: morgan. Volt: robin_42."
            - text: Round 1 · first to 3
      - region "Players" [ref=e60]:
        - generic [ref=e61]:
          - heading "Players" [level=2] [ref=e63]
          - paragraph [ref=e64]: Round 1 · first to 3
        - generic [ref=e65]:
          - generic [ref=e67]:
            - generic [ref=e72]:
              - img "Comet" [ref=e73]:
                - generic [ref=e74]: C
              - generic "avery" [ref=e77]
              - generic [ref=e80]: You
            - generic [ref=e81]: Comet wins 0
          - generic [ref=e83]:
            - generic [ref=e88]:
              - img "Ember" [ref=e89]:
                - generic [ref=e90]: E
              - generic "jordan_plays" [ref=e93]
            - generic [ref=e94]: Ember wins 0
          - generic [ref=e96]:
            - generic [ref=e101]:
              - img "Nova" [ref=e102]:
                - generic [ref=e103]: "N"
              - generic "morgan" [ref=e106]
            - generic [ref=e107]: Nova wins 0
          - generic [ref=e109]:
            - generic [ref=e114]:
              - img "Volt" [ref=e115]:
                - generic [ref=e116]: V
              - generic "robin_42" [ref=e119]
            - generic [ref=e120]: Volt wins 0
        - generic [ref=e122]:
          - group "Game actions" [ref=e123]:
            - button "Resign game" [ref=e124] [cursor=pointer]:
              - paragraph [ref=e127]:
                - text: Resign
                - generic [ref=e128]: game
          - button "History and stats" [ref=e129] [cursor=pointer]:
            - paragraph [ref=e132]: History and stats
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