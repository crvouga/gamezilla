# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--game-over dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  30115 pixels (ratio 0.10 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/game-over-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/game-over-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 30115 pixels (ratio 0.10 of all image pixels) are different.
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
  - 30115 pixels (ratio 0.10 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Hearts" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - heading "morgan wins" [level=2] [ref=e25]
        - group "What next" [ref=e26]:
          - button "Rematch" [ref=e27] [cursor=pointer]:
            - paragraph [ref=e30]: Rematch
          - button "Change game" [ref=e31] [cursor=pointer]:
            - paragraph [ref=e34]: Change game
          - button "Review" [ref=e35] [cursor=pointer]:
            - paragraph [ref=e38]: Review
      - generic [ref=e41]:
        - paragraph [ref=e46]: No moves yet.
        - button "All moves" [ref=e47] [cursor=pointer]:
          - img [ref=e51]
      - generic [ref=e53]:
        - generic [ref=e55]:
          - generic [ref=e57]:
            - group "Hearts table" [ref=e58]:
              - region "South" [ref=e59]:
                - generic [ref=e63]:
                  - generic [ref=e64]: avery
                  - generic [ref=e65]:
                    - generic [ref=e67]: You
                    - generic [ref=e69]: South
                - generic [ref=e70]:
                  - generic [ref=e71]: 0 cards
                  - generic [ref=e72]: Score 42
              - region "West" [ref=e73]:
                - generic [ref=e76]:
                  - generic [ref=e77]: jordan_plays
                  - generic [ref=e80]: West
                - generic [ref=e81]:
                  - generic [ref=e82]: 0 cards
                  - generic [ref=e83]: Score 104
              - region "North" [ref=e84]:
                - generic [ref=e87]:
                  - generic [ref=e88]: morgan
                  - generic [ref=e91]: North
                - generic [ref=e92]:
                  - generic [ref=e93]: 0 cards
                  - generic [ref=e94]: Score 38
              - region "East" [ref=e95]:
                - generic [ref=e98]:
                  - generic [ref=e99]: robin_42
                  - generic [ref=e102]: East
                - generic [ref=e103]:
                  - generic [ref=e104]: 0 cards
                  - generic [ref=e105]: Score 76
              - paragraph [ref=e106]: "The game is over. Final scores: South 42, West 104, North 38, East 76. North wins."
            - toolbar "Your hand" [ref=e107]
            - status
          - status [ref=e109]:
            - generic [ref=e110]:
              - generic [ref=e111]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: A score reached 100, and the lowest score wins.
        - generic [ref=e112]:
          - list "Standings" [ref=e114]:
            - listitem [ref=e115]:
              - generic [ref=e116]:
                - generic [ref=e117]: 1st
                - generic [ref=e120]: morgan
                - generic [ref=e121]:
                  - generic [ref=e122]: Score
                  - text: "38"
            - listitem [ref=e123]:
              - generic [ref=e124]:
                - generic [ref=e125]: 2nd
                - generic [ref=e128]: avery
                - generic [ref=e129]:
                  - generic [ref=e130]: Score
                  - text: "42"
            - listitem [ref=e131]:
              - generic [ref=e132]:
                - generic [ref=e133]: 3rd
                - generic [ref=e136]: robin_42
                - generic [ref=e137]:
                  - generic [ref=e138]: Score
                  - text: "76"
            - listitem [ref=e139]:
              - generic [ref=e140]:
                - generic [ref=e141]: 4th
                - generic [ref=e144]: jordan_plays
                - generic [ref=e145]:
                  - generic [ref=e146]: Score
                  - text: "104"
          - button "History and stats" [ref=e149] [cursor=pointer]:
            - generic [ref=e151]:
              - paragraph [ref=e152]: History and stats
              - img [ref=e155]
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