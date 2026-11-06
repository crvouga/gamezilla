# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--waiting-for-opponent light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  758 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/waiting-for-opponent-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/waiting-for-opponent-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 758 pixels (ratio 0.01 of all image pixels) are different.
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
  - 758 pixels (ratio 0.01 of all image pixels) are different.

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
        - paragraph [ref=e24]: You fired at G2 and hit. Red fleet is firing.
        - generic [ref=e25]:
          - list "Moves played" [ref=e30]:
            - listitem [ref=e31]:
              - generic [ref=e32]: Move 4
              - 'button "Move 7, Blue fleet: G2 hit" [ref=e35] [cursor=pointer]': G2 hit
          - button "All moves" [ref=e36] [cursor=pointer]:
            - img [ref=e40]
      - generic [ref=e42]:
        - generic [ref=e44]:
          - generic [ref=e50]:
            - generic [ref=e51]:
              - img "Red fleet" [ref=e52]
              - generic [ref=e53]: jordan_plays
              - generic [ref=e54]: To move
            - generic [ref=e57]: Destroyer sunk
          - generic [ref=e59]:
            - generic [ref=e61]:
              - radiogroup "Boards" [ref=e63]:
                - radio "Your fleet" [checked] [ref=e64] [cursor=pointer]:
                  - generic [ref=e65]: Your fleet
                - radio "Targeting" [ref=e66] [cursor=pointer]:
                  - generic [ref=e67]: Targeting
              - region "Your fleet" [ref=e68]:
                - group "Your fleet" [ref=e69]:
                  - generic [ref=e71]: A
                  - generic [ref=e72]: B
                  - generic [ref=e73]: C
                  - generic [ref=e74]: D
                  - generic [ref=e75]: E
                  - generic [ref=e76]: F
                  - generic [ref=e77]: G
                  - generic [ref=e78]: H
                  - generic [ref=e79]: I
                  - generic [ref=e80]: J
                  - generic [ref=e81]: "1"
                  - 'button "A1: your Carrier, hit, latest shot" [disabled] [ref=e82]':
                    - generic: ✕
                  - 'button "B1: your Carrier" [disabled] [ref=e83]':
                    - generic: ■
                  - 'button "C1: your Carrier" [disabled] [ref=e84]':
                    - generic: ■
                  - 'button "D1: your Carrier" [disabled] [ref=e85]':
                    - generic: ■
                  - 'button "E1: your Carrier" [disabled] [ref=e86]':
                    - generic: ■
                  - 'button "F1: open water" [disabled] [ref=e87]'
                  - 'button "G1: open water" [disabled] [ref=e88]'
                  - 'button "H1: open water" [disabled] [ref=e89]'
                  - 'button "I1: open water" [disabled] [ref=e90]'
                  - 'button "J1: open water" [disabled] [ref=e91]'
                  - generic [ref=e92]: "2"
                  - 'button "A2: open water, missed" [disabled] [ref=e93]':
                    - generic: ○
                  - 'button "B2: open water" [disabled] [ref=e94]'
                  - 'button "C2: open water" [disabled] [ref=e95]'
                  - 'button "D2: open water" [disabled] [ref=e96]'
                  - 'button "E2: open water" [disabled] [ref=e97]'
                  - 'button "F2: open water" [disabled] [ref=e98]'
                  - 'button "G2: open water" [disabled] [ref=e99]'
                  - 'button "H2: open water" [disabled] [ref=e100]'
                  - 'button "I2: open water" [disabled] [ref=e101]'
                  - 'button "J2: open water" [disabled] [ref=e102]'
                  - generic [ref=e103]: "3"
                  - 'button "A3: your Battleship" [disabled] [ref=e104]':
                    - generic: ■
                  - 'button "B3: your Battleship" [disabled] [ref=e105]':
                    - generic: ■
                  - 'button "C3: your Battleship" [disabled] [ref=e106]':
                    - generic: ■
                  - 'button "D3: your Battleship" [disabled] [ref=e107]':
                    - generic: ■
                  - 'button "E3: open water" [disabled] [ref=e108]'
                  - 'button "F3: open water" [disabled] [ref=e109]'
                  - 'button "G3: open water" [disabled] [ref=e110]'
                  - 'button "H3: open water" [disabled] [ref=e111]'
                  - 'button "I3: open water" [disabled] [ref=e112]'
                  - 'button "J3: open water" [disabled] [ref=e113]'
                  - generic [ref=e114]: "4"
                  - 'button "A4: open water" [disabled] [ref=e115]'
                  - 'button "B4: open water" [disabled] [ref=e116]'
                  - 'button "C4: open water" [disabled] [ref=e117]'
                  - 'button "D4: open water" [disabled] [ref=e118]'
                  - 'button "E4: open water" [disabled] [ref=e119]'
                  - 'button "F4: open water" [disabled] [ref=e120]'
                  - 'button "G4: open water" [disabled] [ref=e121]'
                  - 'button "H4: open water" [disabled] [ref=e122]'
                  - 'button "I4: open water" [disabled] [ref=e123]'
                  - 'button "J4: open water" [disabled] [ref=e124]'
                  - generic [ref=e125]: "5"
                  - 'button "A5: your Cruiser" [disabled] [ref=e126]':
                    - generic: ■
                  - 'button "B5: your Cruiser" [disabled] [ref=e127]':
                    - generic: ■
                  - 'button "C5: your Cruiser" [disabled] [ref=e128]':
                    - generic: ■
                  - 'button "D5: open water" [disabled] [ref=e129]'
                  - 'button "E5: open water" [disabled] [ref=e130]'
                  - 'button "F5: open water" [disabled] [ref=e131]'
                  - 'button "G5: open water" [disabled] [ref=e132]'
                  - 'button "H5: open water" [disabled] [ref=e133]'
                  - 'button "I5: open water" [disabled] [ref=e134]'
                  - 'button "J5: open water" [disabled] [ref=e135]'
                  - generic [ref=e136]: "6"
                  - 'button "A6: open water" [disabled] [ref=e137]'
                  - 'button "B6: open water" [disabled] [ref=e138]'
                  - 'button "C6: open water" [disabled] [ref=e139]'
                  - 'button "D6: open water" [disabled] [ref=e140]'
                  - 'button "E6: open water" [disabled] [ref=e141]'
                  - 'button "F6: open water" [disabled] [ref=e142]'
                  - 'button "G6: open water" [disabled] [ref=e143]'
                  - 'button "H6: open water" [disabled] [ref=e144]'
                  - 'button "I6: open water" [disabled] [ref=e145]'
                  - 'button "J6: open water" [disabled] [ref=e146]'
                  - generic [ref=e147]: "7"
                  - 'button "A7: your Submarine" [disabled] [ref=e148]':
                    - generic: ■
                  - 'button "B7: your Submarine" [disabled] [ref=e149]':
                    - generic: ■
                  - 'button "C7: your Submarine" [disabled] [ref=e150]':
                    - generic: ■
                  - 'button "D7: open water" [disabled] [ref=e151]'
                  - 'button "E7: open water" [disabled] [ref=e152]'
                  - 'button "F7: open water" [disabled] [ref=e153]'
                  - 'button "G7: open water" [disabled] [ref=e154]'
                  - 'button "H7: open water" [disabled] [ref=e155]'
                  - 'button "I7: open water" [disabled] [ref=e156]'
                  - 'button "J7: open water" [disabled] [ref=e157]'
                  - generic [ref=e158]: "8"
                  - 'button "A8: open water" [disabled] [ref=e159]'
                  - 'button "B8: open water" [disabled] [ref=e160]'
                  - 'button "C8: open water" [disabled] [ref=e161]'
                  - 'button "D8: open water" [disabled] [ref=e162]'
                  - 'button "E8: open water" [disabled] [ref=e163]'
                  - 'button "F8: open water" [disabled] [ref=e164]'
                  - 'button "G8: open water" [disabled] [ref=e165]'
                  - 'button "H8: open water" [disabled] [ref=e166]'
                  - 'button "I8: open water" [disabled] [ref=e167]'
                  - 'button "J8: open water" [disabled] [ref=e168]'
                  - generic [ref=e169]: "9"
                  - 'button "A9: your Destroyer" [disabled] [ref=e170]':
                    - generic: ■
                  - 'button "B9: your Destroyer, hit" [disabled] [ref=e171]':
                    - generic: ✕
                  - 'button "C9: open water" [disabled] [ref=e172]'
                  - 'button "D9: open water" [disabled] [ref=e173]'
                  - 'button "E9: open water" [disabled] [ref=e174]'
                  - 'button "F9: open water" [disabled] [ref=e175]'
                  - 'button "G9: open water" [disabled] [ref=e176]'
                  - 'button "H9: open water" [disabled] [ref=e177]'
                  - 'button "I9: open water" [disabled] [ref=e178]'
                  - 'button "J9: open water" [disabled] [ref=e179]'
                  - generic [ref=e180]: "10"
                  - 'button "A10: open water" [disabled] [ref=e181]'
                  - 'button "B10: open water" [disabled] [ref=e182]'
                  - 'button "C10: open water" [disabled] [ref=e183]'
                  - 'button "D10: open water" [disabled] [ref=e184]'
                  - 'button "E10: open water" [disabled] [ref=e185]'
                  - 'button "F10: open water" [disabled] [ref=e186]'
                  - 'button "G10: open water" [disabled] [ref=e187]'
                  - 'button "H10: open water" [disabled] [ref=e188]'
                  - 'button "I10: open water" [disabled] [ref=e189]'
                  - 'button "J10: open water" [disabled] [ref=e190]'
            - list "Key" [ref=e191]:
              - listitem [ref=e192]:
                - generic [ref=e193]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e194]:
                - generic [ref=e195]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e196]:
                - generic [ref=e197]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e198]:
                - generic [ref=e199]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e201]:
            - generic [ref=e202]:
              - generic [ref=e203]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: You fired at G2 and hit. Red fleet is firing.
          - generic [ref=e211]:
            - img "Blue fleet" [ref=e212]
            - generic [ref=e213]: avery
        - generic [ref=e216]:
          - group "Game actions" [ref=e217]:
            - button "Resign game" [ref=e218] [cursor=pointer]:
              - paragraph [ref=e221]:
                - text: Resign
                - generic [ref=e222]: game
          - button "History and stats" [ref=e223] [cursor=pointer]:
            - generic [ref=e225]:
              - paragraph [ref=e226]: History and stats
              - img [ref=e229]
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