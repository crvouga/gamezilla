# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--correct-target-before-firing light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  46360 pixels (ratio 0.04 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/correct-target-before-firing-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/correct-target-before-firing-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 46360 pixels (ratio 0.04 of all image pixels) are different.
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
  - 46360 pixels (ratio 0.04 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Battleship" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e34]:
          - img "Red fleet" [ref=e35]
          - generic "jordan_plays" [ref=e38]
          - generic [ref=e39]: To move
        - generic [ref=e41]:
          - generic [ref=e43]:
            - radiogroup "Boards" [ref=e45]:
              - radio "Your fleet" [ref=e46] [cursor=pointer]:
                - generic [ref=e47]: Your fleet
              - radio "Targeting" [checked] [ref=e48] [cursor=pointer]:
                - generic [ref=e49]: Targeting
            - region "Targeting" [ref=e50]:
              - generic [ref=e51]:
                - group "Targeting" [ref=e52]:
                  - generic [ref=e54]: F
                  - generic [ref=e55]: G
                  - generic [ref=e56]: H
                  - generic [ref=e57]: I
                  - generic [ref=e58]: J
                  - generic [ref=e59]: "6"
                  - 'button "F6: not fired at" [disabled] [ref=e60]'
                  - 'button "G6: not fired at" [disabled] [ref=e61]'
                  - 'button "H6: not fired at" [disabled] [ref=e62]'
                  - 'button "I6: not fired at" [disabled] [ref=e63]'
                  - 'button "J6: not fired at" [disabled] [ref=e64]'
                  - generic [ref=e65]: "7"
                  - 'button "F7: not fired at" [disabled] [ref=e66]'
                  - 'button "G7: not fired at" [disabled] [ref=e67]'
                  - 'button "H7: not fired at" [disabled] [ref=e68]'
                  - 'button "I7: not fired at" [disabled] [ref=e69]'
                  - 'button "J7: not fired at" [disabled] [ref=e70]'
                  - generic [ref=e71]: "8"
                  - 'button "F8: not fired at" [disabled] [ref=e72]'
                  - 'button "G8: not fired at" [disabled] [ref=e73]'
                  - 'button "H8: not fired at" [disabled] [ref=e74]'
                  - 'button "I8: not fired at" [disabled] [ref=e75]'
                  - 'button "J8: not fired at" [disabled] [ref=e76]'
                  - generic [ref=e77]: "9"
                  - 'button "F9: not fired at" [disabled] [ref=e78]'
                  - 'button "G9: not fired at" [disabled] [ref=e79]'
                  - 'button "H9: not fired at" [disabled] [ref=e80]'
                  - 'button "I9: not fired at" [disabled] [ref=e81]'
                  - 'button "J9: not fired at" [disabled] [ref=e82]'
                  - generic [ref=e83]: "10"
                  - 'button "F10: not fired at" [disabled] [ref=e84]'
                  - 'button "G10: not fired at" [disabled] [ref=e85]'
                  - 'button "H10: not fired at" [disabled] [ref=e86]'
                  - 'button "I10: not fired at" [disabled] [ref=e87]'
                  - 'button "J10: miss, latest shot" [disabled] [ref=e88]':
                    - generic: ○
                - generic [ref=e89]:
                  - button "Show whole board" [ref=e90] [cursor=pointer]:
                    - paragraph [ref=e93]: Show whole board
                  - 'button "Target region: F6–J10" [ref=e96] [cursor=pointer]':
                    - paragraph [ref=e97]: F6–J10
                    - img [ref=e99]
          - list "Key" [ref=e101]:
            - listitem [ref=e102]:
              - generic [ref=e103]:
                - generic: ■
              - text: Ship
            - listitem [ref=e104]:
              - generic [ref=e105]:
                - generic: ○
              - text: Miss
            - listitem [ref=e106]:
              - generic [ref=e107]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e108]:
              - generic [ref=e109]:
                - generic: ✖
              - text: Sunk
        - status [ref=e111]:
          - generic [ref=e112]:
            - generic [ref=e113]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: You fired at J10 and missed. Red fleet is firing.
        - generic [ref=e121]:
          - img "Blue fleet" [ref=e122]
          - generic "avery" [ref=e125]
      - region "Game record" [ref=e127]:
        - generic [ref=e128]:
          - heading "Game record" [level=2] [ref=e130]
          - paragraph [ref=e131]: You fired at J10 and missed. Red fleet is firing.
        - generic [ref=e132]:
          - list "Moves played" [ref=e134]:
            - listitem [ref=e135]:
              - generic [ref=e136]: "1"
              - 'button "Move 1, Blue fleet: J10 miss" [ref=e139] [cursor=pointer]': J10 miss
          - generic [ref=e140]:
            - generic [ref=e141]:
              - button "Go to the start" [ref=e142] [cursor=pointer]:
                - img [ref=e145]
              - button "Previous move" [ref=e148] [cursor=pointer]:
                - img [ref=e151]
              - button "Next move" [disabled] [ref=e153]:
                - img [ref=e156]
              - button "Return to current position" [ref=e158] [cursor=pointer]:
                - img [ref=e161]
            - button "Go to move" [ref=e164] [cursor=pointer]:
              - generic [ref=e166]:
                - paragraph [ref=e167]: Go to move
                - img [ref=e170]
        - generic [ref=e173]:
          - group "Game actions" [ref=e174]:
            - button "Resign game" [ref=e175] [cursor=pointer]:
              - paragraph [ref=e178]:
                - text: Resign
                - generic [ref=e179]: game
          - button "History and stats" [ref=e180] [cursor=pointer]:
            - paragraph [ref=e183]: History and stats
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