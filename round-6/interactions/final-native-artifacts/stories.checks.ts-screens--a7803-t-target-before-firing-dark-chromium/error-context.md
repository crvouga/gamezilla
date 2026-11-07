# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--correct-target-before-firing dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  25667 pixels (ratio 0.08 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/correct-target-before-firing-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/correct-target-before-firing-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 25667 pixels (ratio 0.08 of all image pixels) are different.
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
  - 25667 pixels (ratio 0.08 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Battleship" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: You fired at J10 and missed. Red fleet is firing.
        - generic [ref=e25]:
          - list "Moves played" [ref=e30]:
            - listitem [ref=e31]:
              - generic [ref=e32]: Move 1
              - 'button "Move 1, Blue fleet: J10 miss" [ref=e35] [cursor=pointer]': J10 miss
          - button "All moves" [ref=e36] [cursor=pointer]:
            - img [ref=e40]
      - generic [ref=e42]:
        - generic [ref=e44]:
          - generic [ref=e51]:
            - img "Red fleet" [ref=e52]
            - generic "jordan_plays" [ref=e55]
            - generic [ref=e56]: To move
          - generic [ref=e58]:
            - generic [ref=e60]:
              - radiogroup "Boards" [ref=e62]:
                - radio "Your fleet" [ref=e63] [cursor=pointer]:
                  - generic [ref=e64]: Your fleet
                - radio "Targeting" [checked] [ref=e65] [cursor=pointer]:
                  - generic [ref=e66]: Targeting
              - region "Targeting" [ref=e67]:
                - generic [ref=e68]:
                  - group "Targeting" [ref=e69]:
                    - generic [ref=e71]: F
                    - generic [ref=e72]: G
                    - generic [ref=e73]: H
                    - generic [ref=e74]: I
                    - generic [ref=e75]: J
                    - generic [ref=e76]: "6"
                    - 'button "F6: not fired at" [disabled] [ref=e77]'
                    - 'button "G6: not fired at" [disabled] [ref=e78]'
                    - 'button "H6: not fired at" [disabled] [ref=e79]'
                    - 'button "I6: not fired at" [disabled] [ref=e80]'
                    - 'button "J6: not fired at" [disabled] [ref=e81]'
                    - generic [ref=e82]: "7"
                    - 'button "F7: not fired at" [disabled] [ref=e83]'
                    - 'button "G7: not fired at" [disabled] [ref=e84]'
                    - 'button "H7: not fired at" [disabled] [ref=e85]'
                    - 'button "I7: not fired at" [disabled] [ref=e86]'
                    - 'button "J7: not fired at" [disabled] [ref=e87]'
                    - generic [ref=e88]: "8"
                    - 'button "F8: not fired at" [disabled] [ref=e89]'
                    - 'button "G8: not fired at" [disabled] [ref=e90]'
                    - 'button "H8: not fired at" [disabled] [ref=e91]'
                    - 'button "I8: not fired at" [disabled] [ref=e92]'
                    - 'button "J8: not fired at" [disabled] [ref=e93]'
                    - generic [ref=e94]: "9"
                    - 'button "F9: not fired at" [disabled] [ref=e95]'
                    - 'button "G9: not fired at" [disabled] [ref=e96]'
                    - 'button "H9: not fired at" [disabled] [ref=e97]'
                    - 'button "I9: not fired at" [disabled] [ref=e98]'
                    - 'button "J9: not fired at" [disabled] [ref=e99]'
                    - generic [ref=e100]: "10"
                    - 'button "F10: not fired at" [disabled] [ref=e101]'
                    - 'button "G10: not fired at" [disabled] [ref=e102]'
                    - 'button "H10: not fired at" [disabled] [ref=e103]'
                    - 'button "I10: not fired at" [disabled] [ref=e104]'
                    - 'button "J10: miss, latest shot" [disabled] [ref=e105]':
                      - generic: ○
                  - generic [ref=e106]:
                    - button "Show whole board" [ref=e107] [cursor=pointer]:
                      - paragraph [ref=e110]: Show whole board
                    - 'button "Target region: F6–J10" [ref=e113] [cursor=pointer]':
                      - paragraph [ref=e114]: F6–J10
                      - img [ref=e116]
            - list "Key" [ref=e118]:
              - listitem [ref=e119]:
                - generic [ref=e120]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e121]:
                - generic [ref=e122]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e123]:
                - generic [ref=e124]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e125]:
                - generic [ref=e126]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e128]:
            - generic [ref=e129]:
              - generic [ref=e130]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: You fired at J10 and missed. Red fleet is firing.
          - generic [ref=e138]:
            - img "Blue fleet" [ref=e139]
            - generic "avery" [ref=e142]
        - generic [ref=e145]:
          - group "Game actions" [ref=e146]:
            - button "Resign game" [ref=e147] [cursor=pointer]:
              - paragraph [ref=e150]:
                - text: Resign
                - generic [ref=e151]: game
          - button "History and stats" [ref=e152] [cursor=pointer]:
            - generic [ref=e154]:
              - paragraph [ref=e155]: History and stats
              - img [ref=e158]
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