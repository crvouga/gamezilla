# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-light-cycles-arena--quad-steering dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  21666 pixels (ratio 0.07 of all image pixels) are different.

  Snapshot: libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/quad-steering-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/light-cycles-client-ts/src/baselines/chromium/screens-games-light-cycles-arena/quad-steering-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 21666 pixels (ratio 0.07 of all image pixels) are different.
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
  - 21666 pixels (ratio 0.07 of all image pixels) are different.

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
        - list "Players" [ref=e25]:
          - listitem [ref=e26]:
            - generic [ref=e31]:
              - generic [ref=e32]: avery
              - generic [ref=e33]:
                - generic [ref=e35]: C
                - generic [ref=e36]: Comet wins 0
                - generic [ref=e38]: You
          - listitem [ref=e39]:
            - generic [ref=e43]:
              - generic [ref=e44]: jordan_plays
              - generic [ref=e45]:
                - generic [ref=e47]: E
                - generic [ref=e48]: Ember wins 0
          - listitem [ref=e49]:
            - generic [ref=e53]:
              - generic [ref=e54]: morgan
              - generic [ref=e55]:
                - generic [ref=e57]: "N"
                - generic [ref=e58]: Nova wins 0
          - listitem [ref=e59]:
            - generic [ref=e63]:
              - generic [ref=e64]: robin_42
              - generic [ref=e65]:
                - generic [ref=e67]: V
                - generic [ref=e68]: Volt wins 0
        - generic [ref=e70]:
          - generic [ref=e71]: Comet 0Ember 0Nova 0Volt 0Round 1 · first to 3
          - status [ref=e72]: You ride Comet.
          - application "Light Cycles arena" [active] [ref=e73]:
            - img [ref=e74]:
              - generic [ref=e82]:
                - generic: C
              - generic [ref=e86]:
                - generic: E
              - generic [ref=e89]:
                - generic: "N"
              - generic [ref=e92]:
                - generic: V
            - status
          - group [ref=e97]:
            - button "Steer Comet up" [ref=e98] [cursor=pointer]:
              - img [ref=e99]
            - button "Steer Comet left" [ref=e101] [cursor=pointer]:
              - img [ref=e102]
            - button "Steer Comet down" [ref=e104] [cursor=pointer]:
              - img [ref=e105]
            - button "Steer Comet right" [ref=e107] [cursor=pointer]:
              - img [ref=e108]
          - paragraph [ref=e110]: Swipe the arena or use the pad to steer. Avoid the edge and every trail.
        - status [ref=e114]:
          - generic [ref=e115]:
            - generic [ref=e116]: "Comet: avery. Ember: jordan_plays. Nova: morgan. Volt: robin_42."
            - text: Round 1 · first to 3
      - generic [ref=e119]:
        - group "Game actions" [ref=e120]:
          - button "Resign game" [ref=e121] [cursor=pointer]:
            - paragraph [ref=e124]:
              - text: Resign
              - generic [ref=e125]: game
        - button "History and stats" [ref=e126] [cursor=pointer]:
          - generic [ref=e128]:
            - paragraph [ref=e129]: History and stats
            - img [ref=e132]
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