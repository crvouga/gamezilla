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
  21633 pixels (ratio 0.07 of all image pixels) are different.

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
  - 21633 pixels (ratio 0.07 of all image pixels) are different.
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
  - 21633 pixels (ratio 0.07 of all image pixels) are different.

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
      - generic [ref=e24]:
        - paragraph [ref=e29]: No moves yet.
        - button "All moves" [ref=e30] [cursor=pointer]:
          - img [ref=e34]
      - generic [ref=e36]:
        - generic [ref=e38]:
          - generic [ref=e40]:
            - group "Hearts table" [ref=e41]:
              - region "South" [ref=e42]:
                - generic [ref=e48]:
                  - generic [ref=e49]: avery
                  - generic [ref=e50]:
                    - generic [ref=e52]: You
                    - generic [ref=e54]: South
                - generic [ref=e55]:
                  - generic [ref=e56]: 0 cards
                  - generic [ref=e57]: Score 42
              - region "West" [ref=e58]:
                - generic [ref=e63]:
                  - generic [ref=e64]: jordan_plays
                  - generic [ref=e67]: West
                - generic [ref=e68]:
                  - generic [ref=e69]: 0 cards
                  - generic [ref=e70]: ·Score 104
              - region "North" [ref=e71]:
                - generic [ref=e76]:
                  - generic [ref=e77]: morgan
                  - generic [ref=e80]: North
                - generic [ref=e81]:
                  - generic [ref=e82]: 0 cards
                  - generic [ref=e83]: Score 38
              - region "East" [ref=e84]:
                - generic [ref=e89]:
                  - generic [ref=e90]: robin_42
                  - generic [ref=e93]: East
                - generic [ref=e94]:
                  - generic [ref=e95]: 0 cards
                  - generic [ref=e96]: ·Score 76
              - paragraph [ref=e97]: "The game is over. Final scores: South 42, West 104, North 38, East 76. North wins."
            - toolbar "Your hand" [ref=e98]
            - status
          - status [ref=e102]:
            - generic [ref=e103]:
              - generic [ref=e104]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: A score reached 100, and the lowest score wins.
        - generic [ref=e105]:
          - generic [ref=e106]:
            - heading "morgan wins" [level=2] [ref=e108]
            - list "Standings" [ref=e109]:
              - listitem [ref=e110]:
                - generic [ref=e111]:
                  - generic [ref=e112]: 1st
                  - generic [ref=e115]: morgan
                  - generic [ref=e116]:
                    - generic [ref=e117]: Score
                    - text: "38"
              - listitem [ref=e118]:
                - generic [ref=e119]:
                  - generic [ref=e120]: 2nd
                  - generic [ref=e123]: avery
                  - generic [ref=e124]:
                    - generic [ref=e125]: Score
                    - text: "42"
              - listitem [ref=e126]:
                - generic [ref=e127]:
                  - generic [ref=e128]: 3rd
                  - generic [ref=e131]: robin_42
                  - generic [ref=e132]:
                    - generic [ref=e133]: Score
                    - text: "76"
              - listitem [ref=e134]:
                - generic [ref=e135]:
                  - generic [ref=e136]: 4th
                  - generic [ref=e139]: jordan_plays
                  - generic [ref=e140]:
                    - generic [ref=e141]: Score
                    - text: "104"
          - generic [ref=e143]:
            - group "What next" [ref=e144]:
              - button "Rematch" [ref=e145] [cursor=pointer]:
                - paragraph [ref=e148]: Rematch
              - button "Change game" [ref=e149] [cursor=pointer]:
                - paragraph [ref=e152]: Change game
              - button "Review" [ref=e153] [cursor=pointer]:
                - paragraph [ref=e156]: Review
            - button "History and stats" [ref=e157] [cursor=pointer]:
              - generic [ref=e159]:
                - paragraph [ref=e160]: History and stats
                - img [ref=e163]
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