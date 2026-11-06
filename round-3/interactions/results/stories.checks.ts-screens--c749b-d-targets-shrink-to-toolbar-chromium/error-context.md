# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--correct-target-before-firing regression battleship-enlarged-targets-shrink-to-toolbar
- Location: tests/storybook/stories.checks.ts:314:1

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  54400 pixels (ratio 0.17 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/correct-target-before-firing-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/correct-target-before-firing-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 54400 pixels (ratio 0.17 of all image pixels) are different.
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
  - 54400 pixels (ratio 0.17 of all image pixels) are different.

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
            - generic [ref=e53]: jordan_plays
            - generic [ref=e54]: To move
          - generic [ref=e56]:
            - generic [ref=e58]:
              - radiogroup "Boards" [ref=e60]:
                - radio "Your fleet" [ref=e61] [cursor=pointer]:
                  - generic [ref=e62]: Your fleet
                - radio "Targeting" [checked] [ref=e63] [cursor=pointer]:
                  - generic [ref=e64]: Targeting
              - region "Targeting" [ref=e65]:
                - generic [ref=e66]:
                  - group "Targeting" [ref=e67]:
                    - generic [ref=e69]: F
                    - generic [ref=e70]: G
                    - generic [ref=e71]: H
                    - generic [ref=e72]: I
                    - generic [ref=e73]: J
                    - generic [ref=e74]: "6"
                    - 'button "F6: not fired at" [disabled] [ref=e75]'
                    - 'button "G6: not fired at" [disabled] [ref=e76]'
                    - 'button "H6: not fired at" [disabled] [ref=e77]'
                    - 'button "I6: not fired at" [disabled] [ref=e78]'
                    - 'button "J6: not fired at" [disabled] [ref=e79]'
                    - generic [ref=e80]: "7"
                    - 'button "F7: not fired at" [disabled] [ref=e81]'
                    - 'button "G7: not fired at" [disabled] [ref=e82]'
                    - 'button "H7: not fired at" [disabled] [ref=e83]'
                    - 'button "I7: not fired at" [disabled] [ref=e84]'
                    - 'button "J7: not fired at" [disabled] [ref=e85]'
                    - generic [ref=e86]: "8"
                    - 'button "F8: not fired at" [disabled] [ref=e87]'
                    - 'button "G8: not fired at" [disabled] [ref=e88]'
                    - 'button "H8: not fired at" [disabled] [ref=e89]'
                    - 'button "I8: not fired at" [disabled] [ref=e90]'
                    - 'button "J8: not fired at" [disabled] [ref=e91]'
                    - generic [ref=e92]: "9"
                    - 'button "F9: not fired at" [disabled] [ref=e93]'
                    - 'button "G9: not fired at" [disabled] [ref=e94]'
                    - 'button "H9: not fired at" [disabled] [ref=e95]'
                    - 'button "I9: not fired at" [disabled] [ref=e96]'
                    - 'button "J9: not fired at" [disabled] [ref=e97]'
                    - generic [ref=e98]: "10"
                    - 'button "F10: not fired at" [disabled] [ref=e99]'
                    - 'button "G10: not fired at" [disabled] [ref=e100]'
                    - 'button "H10: not fired at" [disabled] [ref=e101]'
                    - 'button "I10: not fired at" [disabled] [ref=e102]'
                    - 'button "J10: miss, latest shot" [disabled] [ref=e103]':
                      - generic: ○
                  - button "Show whole board" [ref=e104] [cursor=pointer]:
                    - paragraph [ref=e107]: Show whole board
                  - generic [ref=e108]:
                    - button "A1–E5" [ref=e109] [cursor=pointer]:
                      - paragraph [ref=e112]: A1–E5
                    - button "F1–J5" [ref=e113] [cursor=pointer]:
                      - paragraph [ref=e116]: F1–J5
                    - button "A6–E10" [ref=e117] [cursor=pointer]:
                      - paragraph [ref=e120]: A6–E10
                    - button "F6–J10" [ref=e121] [cursor=pointer]:
                      - paragraph [ref=e124]: F6–J10
            - list "Key" [ref=e125]:
              - listitem [ref=e126]:
                - generic [ref=e127]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e128]:
                - generic [ref=e129]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e130]:
                - generic [ref=e131]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e132]:
                - generic [ref=e133]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e135]:
            - generic [ref=e136]:
              - generic [ref=e137]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: You fired at J10 and missed. Red fleet is firing.
          - generic [ref=e145]:
            - img "Blue fleet" [ref=e146]
            - generic [ref=e147]: avery
        - generic [ref=e150]:
          - group "Game actions" [ref=e151]:
            - button "Resign game" [ref=e152] [cursor=pointer]:
              - paragraph [ref=e155]:
                - text: Resign
                - generic [ref=e156]: game
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