# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--sink-a-ship light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  32974 pixels (ratio 0.11 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/sink-a-ship-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/sink-a-ship-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 32974 pixels (ratio 0.11 of all image pixels) are different.
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
  - 32974 pixels (ratio 0.11 of all image pixels) are different.

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
        - paragraph [ref=e24]: You fired at G10 and sank the Destroyer. Red fleet is firing.
        - generic [ref=e25]:
          - list "Moves played" [ref=e30]:
            - listitem [ref=e31]:
              - generic [ref=e32]: Move 1
              - 'button "Move 3, Blue fleet: G10 sinks the destroyer" [ref=e35] [cursor=pointer]': G10 sinks the destroyer
          - button "All moves" [ref=e36] [cursor=pointer]:
            - img [ref=e40]
      - generic [ref=e42]:
        - generic [ref=e44]:
          - generic [ref=e50]:
            - generic [ref=e51]:
              - img "Red fleet" [ref=e52]
              - generic "jordan_plays" [ref=e55]
              - generic [ref=e56]: To move
            - generic [ref=e59]: Destroyer sunk
          - generic [ref=e61]:
            - generic [ref=e63]:
              - radiogroup "Boards" [ref=e65]:
                - radio "Your fleet" [ref=e66] [cursor=pointer]:
                  - generic [ref=e67]: Your fleet
                - radio "Targeting" [checked] [ref=e68] [cursor=pointer]:
                  - generic [ref=e69]: Targeting
              - region "Targeting" [ref=e70]:
                - generic [ref=e71]:
                  - group "Targeting" [ref=e72]:
                    - generic [ref=e74]: A
                    - generic [ref=e75]: B
                    - generic [ref=e76]: C
                    - generic [ref=e77]: D
                    - generic [ref=e78]: E
                    - generic [ref=e79]: F
                    - generic [ref=e80]: G
                    - generic [ref=e81]: H
                    - generic [ref=e82]: I
                    - generic [ref=e83]: J
                    - generic [ref=e84]: "1"
                    - 'button "A1: not fired at" [disabled] [ref=e85]'
                    - 'button "B1: not fired at" [disabled] [ref=e86]'
                    - 'button "C1: not fired at" [disabled] [ref=e87]'
                    - 'button "D1: not fired at" [disabled] [ref=e88]'
                    - 'button "E1: not fired at" [disabled] [ref=e89]'
                    - 'button "F1: not fired at" [disabled] [ref=e90]'
                    - 'button "G1: not fired at" [disabled] [ref=e91]'
                    - 'button "H1: not fired at" [disabled] [ref=e92]'
                    - 'button "I1: not fired at" [disabled] [ref=e93]'
                    - 'button "J1: not fired at" [disabled] [ref=e94]'
                    - generic [ref=e95]: "2"
                    - 'button "A2: not fired at" [disabled] [ref=e96]'
                    - 'button "B2: not fired at" [disabled] [ref=e97]'
                    - 'button "C2: not fired at" [disabled] [ref=e98]'
                    - 'button "D2: not fired at" [disabled] [ref=e99]'
                    - 'button "E2: not fired at" [disabled] [ref=e100]'
                    - 'button "F2: not fired at" [disabled] [ref=e101]'
                    - 'button "G2: not fired at" [disabled] [ref=e102]'
                    - 'button "H2: not fired at" [disabled] [ref=e103]'
                    - 'button "I2: not fired at" [disabled] [ref=e104]'
                    - 'button "J2: not fired at" [disabled] [ref=e105]'
                    - generic [ref=e106]: "3"
                    - 'button "A3: not fired at" [disabled] [ref=e107]'
                    - 'button "B3: not fired at" [disabled] [ref=e108]'
                    - 'button "C3: not fired at" [disabled] [ref=e109]'
                    - 'button "D3: not fired at" [disabled] [ref=e110]'
                    - 'button "E3: not fired at" [disabled] [ref=e111]'
                    - 'button "F3: not fired at" [disabled] [ref=e112]'
                    - 'button "G3: not fired at" [disabled] [ref=e113]'
                    - 'button "H3: not fired at" [disabled] [ref=e114]'
                    - 'button "I3: not fired at" [disabled] [ref=e115]'
                    - 'button "J3: not fired at" [disabled] [ref=e116]'
                    - generic [ref=e117]: "4"
                    - 'button "A4: not fired at" [disabled] [ref=e118]'
                    - 'button "B4: not fired at" [disabled] [ref=e119]'
                    - 'button "C4: not fired at" [disabled] [ref=e120]'
                    - 'button "D4: not fired at" [disabled] [ref=e121]'
                    - 'button "E4: not fired at" [disabled] [ref=e122]'
                    - 'button "F4: not fired at" [disabled] [ref=e123]'
                    - 'button "G4: not fired at" [disabled] [ref=e124]'
                    - 'button "H4: not fired at" [disabled] [ref=e125]'
                    - 'button "I4: not fired at" [disabled] [ref=e126]'
                    - 'button "J4: not fired at" [disabled] [ref=e127]'
                    - generic [ref=e128]: "5"
                    - 'button "A5: not fired at" [disabled] [ref=e129]'
                    - 'button "B5: not fired at" [disabled] [ref=e130]'
                    - 'button "C5: not fired at" [disabled] [ref=e131]'
                    - 'button "D5: not fired at" [disabled] [ref=e132]'
                    - 'button "E5: not fired at" [disabled] [ref=e133]'
                    - 'button "F5: not fired at" [disabled] [ref=e134]'
                    - 'button "G5: not fired at" [disabled] [ref=e135]'
                    - 'button "H5: not fired at" [disabled] [ref=e136]'
                    - 'button "I5: not fired at" [disabled] [ref=e137]'
                    - 'button "J5: not fired at" [disabled] [ref=e138]'
                    - generic [ref=e139]: "6"
                    - 'button "A6: not fired at" [disabled] [ref=e140]'
                    - 'button "B6: not fired at" [disabled] [ref=e141]'
                    - 'button "C6: not fired at" [disabled] [ref=e142]'
                    - 'button "D6: not fired at" [disabled] [ref=e143]'
                    - 'button "E6: not fired at" [disabled] [ref=e144]'
                    - 'button "F6: not fired at" [disabled] [ref=e145]'
                    - 'button "G6: not fired at" [disabled] [ref=e146]'
                    - 'button "H6: not fired at" [disabled] [ref=e147]'
                    - 'button "I6: not fired at" [disabled] [ref=e148]'
                    - 'button "J6: not fired at" [disabled] [ref=e149]'
                    - generic [ref=e150]: "7"
                    - 'button "A7: not fired at" [disabled] [ref=e151]'
                    - 'button "B7: not fired at" [disabled] [ref=e152]'
                    - 'button "C7: not fired at" [disabled] [ref=e153]'
                    - 'button "D7: not fired at" [disabled] [ref=e154]'
                    - 'button "E7: not fired at" [disabled] [ref=e155]'
                    - 'button "F7: not fired at" [disabled] [ref=e156]'
                    - 'button "G7: not fired at" [disabled] [ref=e157]'
                    - 'button "H7: not fired at" [disabled] [ref=e158]'
                    - 'button "I7: not fired at" [disabled] [ref=e159]'
                    - 'button "J7: not fired at" [disabled] [ref=e160]'
                    - generic [ref=e161]: "8"
                    - 'button "A8: not fired at" [disabled] [ref=e162]'
                    - 'button "B8: not fired at" [disabled] [ref=e163]'
                    - 'button "C8: not fired at" [disabled] [ref=e164]'
                    - 'button "D8: not fired at" [disabled] [ref=e165]'
                    - 'button "E8: not fired at" [disabled] [ref=e166]'
                    - 'button "F8: not fired at" [disabled] [ref=e167]'
                    - 'button "G8: not fired at" [disabled] [ref=e168]'
                    - 'button "H8: not fired at" [disabled] [ref=e169]'
                    - 'button "I8: not fired at" [disabled] [ref=e170]'
                    - 'button "J8: not fired at" [disabled] [ref=e171]'
                    - generic [ref=e172]: "9"
                    - 'button "A9: not fired at" [disabled] [ref=e173]'
                    - 'button "B9: not fired at" [disabled] [ref=e174]'
                    - 'button "C9: not fired at" [disabled] [ref=e175]'
                    - 'button "D9: not fired at" [disabled] [ref=e176]'
                    - 'button "E9: not fired at" [disabled] [ref=e177]'
                    - 'button "F9: not fired at" [disabled] [ref=e178]'
                    - 'button "G9: not fired at" [disabled] [ref=e179]'
                    - 'button "H9: not fired at" [disabled] [ref=e180]'
                    - 'button "I9: not fired at" [disabled] [ref=e181]'
                    - 'button "J9: not fired at" [disabled] [ref=e182]'
                    - generic [ref=e183]: "10"
                    - 'button "A10: not fired at" [disabled] [ref=e184]'
                    - 'button "B10: not fired at" [disabled] [ref=e185]'
                    - 'button "C10: not fired at" [disabled] [ref=e186]'
                    - 'button "D10: not fired at" [disabled] [ref=e187]'
                    - 'button "E10: not fired at" [disabled] [ref=e188]'
                    - 'button "F10: hit, sunk Destroyer" [disabled] [ref=e189]':
                      - generic: ✖
                    - 'button "G10: hit, sunk Destroyer, latest shot" [disabled] [active] [ref=e190]':
                      - generic: ✖
                    - 'button "H10: not fired at" [disabled] [ref=e191]'
                    - 'button "I10: not fired at" [disabled] [ref=e192]'
                    - 'button "J10: not fired at" [disabled] [ref=e193]'
                  - button "Larger targets" [ref=e195] [cursor=pointer]:
                    - paragraph [ref=e198]: Larger targets
            - list "Key" [ref=e199]:
              - listitem [ref=e200]:
                - generic [ref=e201]:
                  - generic: ■
                - text: Ship
              - listitem [ref=e202]:
                - generic [ref=e203]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e204]:
                - generic [ref=e205]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e206]:
                - generic [ref=e207]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e209]:
            - generic [ref=e210]:
              - generic [ref=e211]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: You fired at G10 and sank the Destroyer. Red fleet is firing.
          - generic [ref=e219]:
            - img "Blue fleet" [ref=e220]
            - generic "avery" [ref=e223]
        - generic [ref=e226]:
          - group "Game actions" [ref=e227]:
            - button "Resign game" [ref=e228] [cursor=pointer]:
              - paragraph [ref=e231]:
                - text: Resign
                - generic [ref=e232]: game
          - button "History and stats" [ref=e233] [cursor=pointer]:
            - generic [ref=e235]:
              - paragraph [ref=e236]: History and stats
              - img [ref=e239]
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