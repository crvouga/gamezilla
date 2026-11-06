# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-hearts-board--game-over dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  72967 pixels (ratio 0.07 of all image pixels) are different.

  Snapshot: libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/game-over-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/hearts-client-ts/src/baselines/chromium/screens-games-hearts-board/game-over-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 72967 pixels (ratio 0.07 of all image pixels) are different.
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
  - 72967 pixels (ratio 0.07 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Hearts" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e24]:
      - generic [ref=e26]:
        - heading "morgan wins" [level=2] [ref=e28]
        - group "What next" [ref=e29]:
          - button "Rematch" [ref=e30] [cursor=pointer]:
            - paragraph [ref=e33]: Rematch
          - button "Change game" [ref=e34] [cursor=pointer]:
            - paragraph [ref=e37]: Change game
          - button "Review" [ref=e38] [cursor=pointer]:
            - paragraph [ref=e41]: Review
      - generic [ref=e42]:
        - generic [ref=e44]:
          - generic [ref=e46]:
            - group "Hearts table" [ref=e47]:
              - region "South" [ref=e48]:
                - generic [ref=e54]:
                  - generic [ref=e55]: avery
                  - generic [ref=e56]:
                    - generic [ref=e58]: You
                    - generic [ref=e60]: South
                - generic [ref=e61]:
                  - generic [ref=e62]: 0 cards
                  - generic [ref=e63]: Score 42
              - region "West" [ref=e64]:
                - generic [ref=e69]:
                  - generic [ref=e70]: jordan_plays
                  - generic [ref=e73]: West
                - generic [ref=e74]:
                  - generic [ref=e75]: 0 cards
                  - generic [ref=e76]: Score 104
              - region "North" [ref=e77]:
                - generic [ref=e82]:
                  - generic [ref=e83]: morgan
                  - generic [ref=e86]: North
                - generic [ref=e87]:
                  - generic [ref=e88]: 0 cards
                  - generic [ref=e89]: Score 38
              - region "East" [ref=e90]:
                - generic [ref=e95]:
                  - generic [ref=e96]: robin_42
                  - generic [ref=e99]: East
                - generic [ref=e100]:
                  - generic [ref=e101]: 0 cards
                  - generic [ref=e102]: Score 76
              - paragraph [ref=e103]: "The game is over. Final scores: South 42, West 104, North 38, East 76. North wins."
            - toolbar "Your hand" [ref=e104]
            - status
          - status [ref=e106]:
            - generic [ref=e107]:
              - generic [ref=e108]: "South: avery. West: jordan_plays. North: morgan. East: robin_42."
              - text: A score reached 100, and the lowest score wins.
        - list "Standings" [ref=e111]:
          - listitem [ref=e112]:
            - generic [ref=e113]:
              - generic [ref=e114]: 1st
              - generic [ref=e117]: morgan
              - generic [ref=e118]:
                - generic [ref=e119]: Score
                - text: "38"
          - listitem [ref=e120]:
            - generic [ref=e121]:
              - generic [ref=e122]: 2nd
              - generic [ref=e125]: avery
              - generic [ref=e126]:
                - generic [ref=e127]: Score
                - text: "42"
          - listitem [ref=e128]:
            - generic [ref=e129]:
              - generic [ref=e130]: 3rd
              - generic [ref=e133]: robin_42
              - generic [ref=e134]:
                - generic [ref=e135]: Score
                - text: "76"
          - listitem [ref=e136]:
            - generic [ref=e137]:
              - generic [ref=e138]: 4th
              - generic [ref=e141]: jordan_plays
              - generic [ref=e142]:
                - generic [ref=e143]: Score
                - text: "104"
        - region "Game record" [ref=e146]:
          - generic [ref=e147]:
            - heading "Game record" [level=2] [ref=e149]
            - paragraph [ref=e150]: A score reached 100, and the lowest score wins.
          - button "History and stats" [ref=e153] [cursor=pointer]:
            - paragraph [ref=e156]: History and stats
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