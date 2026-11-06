# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--hit-a-ship light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  61957 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/hit-a-ship-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/hit-a-ship-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 61957 pixels (ratio 0.06 of all image pixels) are different.
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
  - 61957 pixels (ratio 0.06 of all image pixels) are different.

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
          - generic [ref=e36]: jordan_plays
          - generic [ref=e37]: To move
        - generic [ref=e39]:
          - generic [ref=e41]:
            - radiogroup "Boards" [ref=e43]:
              - radio "Your fleet" [ref=e44] [cursor=pointer]:
                - generic [ref=e45]: Your fleet
              - radio "Targeting" [checked] [ref=e46] [cursor=pointer]:
                - generic [ref=e47]: Targeting
            - region "Targeting" [ref=e48]:
              - generic [ref=e49]:
                - group "Targeting" [ref=e50]:
                  - generic [ref=e52]: A
                  - generic [ref=e53]: B
                  - generic [ref=e54]: C
                  - generic [ref=e55]: D
                  - generic [ref=e56]: E
                  - generic [ref=e57]: F
                  - generic [ref=e58]: G
                  - generic [ref=e59]: H
                  - generic [ref=e60]: I
                  - generic [ref=e61]: J
                  - generic [ref=e62]: "1"
                  - 'button "A1: not fired at" [disabled] [ref=e63]'
                  - 'button "B1: not fired at" [disabled] [ref=e64]'
                  - 'button "C1: not fired at" [disabled] [ref=e65]'
                  - 'button "D1: not fired at" [disabled] [ref=e66]'
                  - 'button "E1: not fired at" [disabled] [ref=e67]'
                  - 'button "F1: not fired at" [disabled] [ref=e68]'
                  - 'button "G1: not fired at" [disabled] [ref=e69]'
                  - 'button "H1: not fired at" [disabled] [ref=e70]'
                  - 'button "I1: not fired at" [disabled] [ref=e71]'
                  - 'button "J1: not fired at" [disabled] [ref=e72]'
                  - generic [ref=e73]: "2"
                  - 'button "A2: not fired at" [disabled] [ref=e74]'
                  - 'button "B2: not fired at" [disabled] [ref=e75]'
                  - 'button "C2: not fired at" [disabled] [ref=e76]'
                  - 'button "D2: not fired at" [disabled] [ref=e77]'
                  - 'button "E2: not fired at" [disabled] [ref=e78]'
                  - 'button "F2: not fired at" [disabled] [ref=e79]'
                  - 'button "G2: not fired at" [disabled] [ref=e80]'
                  - 'button "H2: not fired at" [disabled] [ref=e81]'
                  - 'button "I2: not fired at" [disabled] [ref=e82]'
                  - 'button "J2: not fired at" [disabled] [ref=e83]'
                  - generic [ref=e84]: "3"
                  - 'button "A3: not fired at" [disabled] [ref=e85]'
                  - 'button "B3: not fired at" [disabled] [ref=e86]'
                  - 'button "C3: not fired at" [disabled] [ref=e87]'
                  - 'button "D3: not fired at" [disabled] [ref=e88]'
                  - 'button "E3: not fired at" [disabled] [ref=e89]'
                  - 'button "F3: not fired at" [disabled] [ref=e90]'
                  - 'button "G3: not fired at" [disabled] [ref=e91]'
                  - 'button "H3: not fired at" [disabled] [ref=e92]'
                  - 'button "I3: not fired at" [disabled] [ref=e93]'
                  - 'button "J3: not fired at" [disabled] [ref=e94]'
                  - generic [ref=e95]: "4"
                  - 'button "A4: not fired at" [disabled] [ref=e96]'
                  - 'button "B4: not fired at" [disabled] [ref=e97]'
                  - 'button "C4: not fired at" [disabled] [ref=e98]'
                  - 'button "D4: not fired at" [disabled] [ref=e99]'
                  - 'button "E4: not fired at" [disabled] [ref=e100]'
                  - 'button "F4: not fired at" [disabled] [ref=e101]'
                  - 'button "G4: not fired at" [disabled] [ref=e102]'
                  - 'button "H4: not fired at" [disabled] [ref=e103]'
                  - 'button "I4: not fired at" [disabled] [ref=e104]'
                  - 'button "J4: not fired at" [disabled] [ref=e105]'
                  - generic [ref=e106]: "5"
                  - 'button "A5: not fired at" [disabled] [ref=e107]'
                  - 'button "B5: not fired at" [disabled] [ref=e108]'
                  - 'button "C5: not fired at" [disabled] [ref=e109]'
                  - 'button "D5: not fired at" [disabled] [ref=e110]'
                  - 'button "E5: not fired at" [disabled] [ref=e111]'
                  - 'button "F5: not fired at" [disabled] [ref=e112]'
                  - 'button "G5: not fired at" [disabled] [ref=e113]'
                  - 'button "H5: not fired at" [disabled] [ref=e114]'
                  - 'button "I5: not fired at" [disabled] [ref=e115]'
                  - 'button "J5: not fired at" [disabled] [ref=e116]'
                  - generic [ref=e117]: "6"
                  - 'button "A6: not fired at" [disabled] [ref=e118]'
                  - 'button "B6: not fired at" [disabled] [ref=e119]'
                  - 'button "C6: not fired at" [disabled] [ref=e120]'
                  - 'button "D6: not fired at" [disabled] [ref=e121]'
                  - 'button "E6: not fired at" [disabled] [ref=e122]'
                  - 'button "F6: not fired at" [disabled] [ref=e123]'
                  - 'button "G6: not fired at" [disabled] [ref=e124]'
                  - 'button "H6: not fired at" [disabled] [ref=e125]'
                  - 'button "I6: not fired at" [disabled] [ref=e126]'
                  - 'button "J6: not fired at" [disabled] [ref=e127]'
                  - generic [ref=e128]: "7"
                  - 'button "A7: not fired at" [disabled] [ref=e129]'
                  - 'button "B7: not fired at" [disabled] [ref=e130]'
                  - 'button "C7: not fired at" [disabled] [ref=e131]'
                  - 'button "D7: not fired at" [disabled] [ref=e132]'
                  - 'button "E7: not fired at" [disabled] [ref=e133]'
                  - 'button "F7: not fired at" [disabled] [ref=e134]'
                  - 'button "G7: not fired at" [disabled] [ref=e135]'
                  - 'button "H7: not fired at" [disabled] [ref=e136]'
                  - 'button "I7: not fired at" [disabled] [ref=e137]'
                  - 'button "J7: not fired at" [disabled] [ref=e138]'
                  - generic [ref=e139]: "8"
                  - 'button "A8: not fired at" [disabled] [ref=e140]'
                  - 'button "B8: not fired at" [disabled] [ref=e141]'
                  - 'button "C8: not fired at" [disabled] [ref=e142]'
                  - 'button "D8: not fired at" [disabled] [ref=e143]'
                  - 'button "E8: not fired at" [disabled] [ref=e144]'
                  - 'button "F8: not fired at" [disabled] [ref=e145]'
                  - 'button "G8: not fired at" [disabled] [ref=e146]'
                  - 'button "H8: not fired at" [disabled] [ref=e147]'
                  - 'button "I8: not fired at" [disabled] [ref=e148]'
                  - 'button "J8: not fired at" [disabled] [ref=e149]'
                  - generic [ref=e150]: "9"
                  - 'button "A9: not fired at" [disabled] [ref=e151]'
                  - 'button "B9: not fired at" [disabled] [ref=e152]'
                  - 'button "C9: not fired at" [disabled] [ref=e153]'
                  - 'button "D9: not fired at" [disabled] [ref=e154]'
                  - 'button "E9: not fired at" [disabled] [ref=e155]'
                  - 'button "F9: not fired at" [disabled] [ref=e156]'
                  - 'button "G9: not fired at" [disabled] [ref=e157]'
                  - 'button "H9: not fired at" [disabled] [ref=e158]'
                  - 'button "I9: not fired at" [disabled] [ref=e159]'
                  - 'button "J9: not fired at" [disabled] [ref=e160]'
                  - generic [ref=e161]: "10"
                  - 'button "A10: not fired at" [disabled] [ref=e162]'
                  - 'button "B10: not fired at" [disabled] [ref=e163]'
                  - 'button "C10: not fired at" [disabled] [ref=e164]'
                  - 'button "D10: not fired at" [disabled] [ref=e165]'
                  - 'button "E10: not fired at" [disabled] [ref=e166]'
                  - 'button "F10: hit, latest shot" [disabled] [active] [ref=e167]':
                    - generic: ✕
                  - 'button "G10: not fired at" [disabled] [ref=e168]'
                  - 'button "H10: not fired at" [disabled] [ref=e169]'
                  - 'button "I10: not fired at" [disabled] [ref=e170]'
                  - 'button "J10: not fired at" [disabled] [ref=e171]'
                - button "Larger targets" [ref=e172] [cursor=pointer]:
                  - paragraph [ref=e175]: Larger targets
          - list "Key" [ref=e176]:
            - listitem [ref=e177]:
              - generic [ref=e178]:
                - generic: ■
              - text: Ship
            - listitem [ref=e179]:
              - generic [ref=e180]:
                - generic: ○
              - text: Miss
            - listitem [ref=e181]:
              - generic [ref=e182]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e183]:
              - generic [ref=e184]:
                - generic: ✖
              - text: Sunk
        - status [ref=e186]:
          - generic [ref=e187]:
            - generic [ref=e188]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: You fired at F10 and hit. Red fleet is firing.
        - generic [ref=e196]:
          - img "Blue fleet" [ref=e197]
          - generic [ref=e198]: avery
      - region "Game record" [ref=e200]:
        - generic [ref=e201]:
          - heading "Game record" [level=2] [ref=e203]
          - paragraph [ref=e204]: You fired at F10 and hit. Red fleet is firing.
        - generic [ref=e205]:
          - list "Moves played" [ref=e207]:
            - listitem [ref=e208]:
              - generic [ref=e209]: "1"
              - 'button "Move 1, Blue fleet: F10 hit" [ref=e212] [cursor=pointer]': F10 hit
          - generic [ref=e213]:
            - generic [ref=e214]:
              - button "Go to the start" [ref=e215] [cursor=pointer]:
                - img [ref=e218]
              - button "Previous move" [ref=e221] [cursor=pointer]:
                - img [ref=e224]
              - button "Next move" [disabled] [ref=e226]:
                - img [ref=e229]
              - button "Return to current position" [ref=e231] [cursor=pointer]:
                - img [ref=e234]
            - button "Go to move" [ref=e237] [cursor=pointer]:
              - generic [ref=e239]:
                - paragraph [ref=e240]: Go to move
                - img [ref=e243]
        - generic [ref=e246]:
          - group "Game actions" [ref=e247]:
            - button "Resign game" [ref=e248] [cursor=pointer]:
              - paragraph [ref=e251]:
                - text: Resign
                - generic [ref=e252]: game
          - button "History and stats" [ref=e253] [cursor=pointer]:
            - paragraph [ref=e256]: History and stats
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