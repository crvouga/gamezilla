# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--waiting-for-opponent dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1676 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/waiting-for-opponent-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/waiting-for-opponent-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1676 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1676 pixels (ratio 0.01 of all image pixels) are different.

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
        - generic [ref=e33]:
          - generic [ref=e34]:
            - img "Red fleet" [ref=e35]
            - generic [ref=e36]: jordan_plays
            - generic [ref=e37]: To move
          - generic [ref=e40]: Destroyer sunk
        - generic [ref=e42]:
          - generic [ref=e44]:
            - radiogroup "Boards" [ref=e46]:
              - radio "Your fleet" [checked] [ref=e47] [cursor=pointer]:
                - generic [ref=e48]: Your fleet
              - radio "Targeting" [ref=e49] [cursor=pointer]:
                - generic [ref=e50]: Targeting
            - region "Your fleet" [ref=e51]:
              - group "Your fleet" [ref=e52]:
                - generic [ref=e54]: A
                - generic [ref=e55]: B
                - generic [ref=e56]: C
                - generic [ref=e57]: D
                - generic [ref=e58]: E
                - generic [ref=e59]: F
                - generic [ref=e60]: G
                - generic [ref=e61]: H
                - generic [ref=e62]: I
                - generic [ref=e63]: J
                - generic [ref=e64]: "1"
                - 'button "A1: your Carrier, hit, latest shot" [disabled] [ref=e65]':
                  - generic: ✕
                - 'button "B1: your Carrier" [disabled] [ref=e66]':
                  - generic: ■
                - 'button "C1: your Carrier" [disabled] [ref=e67]':
                  - generic: ■
                - 'button "D1: your Carrier" [disabled] [ref=e68]':
                  - generic: ■
                - 'button "E1: your Carrier" [disabled] [ref=e69]':
                  - generic: ■
                - 'button "F1: open water" [disabled] [ref=e70]'
                - 'button "G1: open water" [disabled] [ref=e71]'
                - 'button "H1: open water" [disabled] [ref=e72]'
                - 'button "I1: open water" [disabled] [ref=e73]'
                - 'button "J1: open water" [disabled] [ref=e74]'
                - generic [ref=e75]: "2"
                - 'button "A2: open water, missed" [disabled] [ref=e76]':
                  - generic: ○
                - 'button "B2: open water" [disabled] [ref=e77]'
                - 'button "C2: open water" [disabled] [ref=e78]'
                - 'button "D2: open water" [disabled] [ref=e79]'
                - 'button "E2: open water" [disabled] [ref=e80]'
                - 'button "F2: open water" [disabled] [ref=e81]'
                - 'button "G2: open water" [disabled] [ref=e82]'
                - 'button "H2: open water" [disabled] [ref=e83]'
                - 'button "I2: open water" [disabled] [ref=e84]'
                - 'button "J2: open water" [disabled] [ref=e85]'
                - generic [ref=e86]: "3"
                - 'button "A3: your Battleship" [disabled] [ref=e87]':
                  - generic: ■
                - 'button "B3: your Battleship" [disabled] [ref=e88]':
                  - generic: ■
                - 'button "C3: your Battleship" [disabled] [ref=e89]':
                  - generic: ■
                - 'button "D3: your Battleship" [disabled] [ref=e90]':
                  - generic: ■
                - 'button "E3: open water" [disabled] [ref=e91]'
                - 'button "F3: open water" [disabled] [ref=e92]'
                - 'button "G3: open water" [disabled] [ref=e93]'
                - 'button "H3: open water" [disabled] [ref=e94]'
                - 'button "I3: open water" [disabled] [ref=e95]'
                - 'button "J3: open water" [disabled] [ref=e96]'
                - generic [ref=e97]: "4"
                - 'button "A4: open water" [disabled] [ref=e98]'
                - 'button "B4: open water" [disabled] [ref=e99]'
                - 'button "C4: open water" [disabled] [ref=e100]'
                - 'button "D4: open water" [disabled] [ref=e101]'
                - 'button "E4: open water" [disabled] [ref=e102]'
                - 'button "F4: open water" [disabled] [ref=e103]'
                - 'button "G4: open water" [disabled] [ref=e104]'
                - 'button "H4: open water" [disabled] [ref=e105]'
                - 'button "I4: open water" [disabled] [ref=e106]'
                - 'button "J4: open water" [disabled] [ref=e107]'
                - generic [ref=e108]: "5"
                - 'button "A5: your Cruiser" [disabled] [ref=e109]':
                  - generic: ■
                - 'button "B5: your Cruiser" [disabled] [ref=e110]':
                  - generic: ■
                - 'button "C5: your Cruiser" [disabled] [ref=e111]':
                  - generic: ■
                - 'button "D5: open water" [disabled] [ref=e112]'
                - 'button "E5: open water" [disabled] [ref=e113]'
                - 'button "F5: open water" [disabled] [ref=e114]'
                - 'button "G5: open water" [disabled] [ref=e115]'
                - 'button "H5: open water" [disabled] [ref=e116]'
                - 'button "I5: open water" [disabled] [ref=e117]'
                - 'button "J5: open water" [disabled] [ref=e118]'
                - generic [ref=e119]: "6"
                - 'button "A6: open water" [disabled] [ref=e120]'
                - 'button "B6: open water" [disabled] [ref=e121]'
                - 'button "C6: open water" [disabled] [ref=e122]'
                - 'button "D6: open water" [disabled] [ref=e123]'
                - 'button "E6: open water" [disabled] [ref=e124]'
                - 'button "F6: open water" [disabled] [ref=e125]'
                - 'button "G6: open water" [disabled] [ref=e126]'
                - 'button "H6: open water" [disabled] [ref=e127]'
                - 'button "I6: open water" [disabled] [ref=e128]'
                - 'button "J6: open water" [disabled] [ref=e129]'
                - generic [ref=e130]: "7"
                - 'button "A7: your Submarine" [disabled] [ref=e131]':
                  - generic: ■
                - 'button "B7: your Submarine" [disabled] [ref=e132]':
                  - generic: ■
                - 'button "C7: your Submarine" [disabled] [ref=e133]':
                  - generic: ■
                - 'button "D7: open water" [disabled] [ref=e134]'
                - 'button "E7: open water" [disabled] [ref=e135]'
                - 'button "F7: open water" [disabled] [ref=e136]'
                - 'button "G7: open water" [disabled] [ref=e137]'
                - 'button "H7: open water" [disabled] [ref=e138]'
                - 'button "I7: open water" [disabled] [ref=e139]'
                - 'button "J7: open water" [disabled] [ref=e140]'
                - generic [ref=e141]: "8"
                - 'button "A8: open water" [disabled] [ref=e142]'
                - 'button "B8: open water" [disabled] [ref=e143]'
                - 'button "C8: open water" [disabled] [ref=e144]'
                - 'button "D8: open water" [disabled] [ref=e145]'
                - 'button "E8: open water" [disabled] [ref=e146]'
                - 'button "F8: open water" [disabled] [ref=e147]'
                - 'button "G8: open water" [disabled] [ref=e148]'
                - 'button "H8: open water" [disabled] [ref=e149]'
                - 'button "I8: open water" [disabled] [ref=e150]'
                - 'button "J8: open water" [disabled] [ref=e151]'
                - generic [ref=e152]: "9"
                - 'button "A9: your Destroyer" [disabled] [ref=e153]':
                  - generic: ■
                - 'button "B9: your Destroyer, hit" [disabled] [ref=e154]':
                  - generic: ✕
                - 'button "C9: open water" [disabled] [ref=e155]'
                - 'button "D9: open water" [disabled] [ref=e156]'
                - 'button "E9: open water" [disabled] [ref=e157]'
                - 'button "F9: open water" [disabled] [ref=e158]'
                - 'button "G9: open water" [disabled] [ref=e159]'
                - 'button "H9: open water" [disabled] [ref=e160]'
                - 'button "I9: open water" [disabled] [ref=e161]'
                - 'button "J9: open water" [disabled] [ref=e162]'
                - generic [ref=e163]: "10"
                - 'button "A10: open water" [disabled] [ref=e164]'
                - 'button "B10: open water" [disabled] [ref=e165]'
                - 'button "C10: open water" [disabled] [ref=e166]'
                - 'button "D10: open water" [disabled] [ref=e167]'
                - 'button "E10: open water" [disabled] [ref=e168]'
                - 'button "F10: open water" [disabled] [ref=e169]'
                - 'button "G10: open water" [disabled] [ref=e170]'
                - 'button "H10: open water" [disabled] [ref=e171]'
                - 'button "I10: open water" [disabled] [ref=e172]'
                - 'button "J10: open water" [disabled] [ref=e173]'
          - list "Key" [ref=e174]:
            - listitem [ref=e175]:
              - generic [ref=e176]:
                - generic: ■
              - text: Ship
            - listitem [ref=e177]:
              - generic [ref=e178]:
                - generic: ○
              - text: Miss
            - listitem [ref=e179]:
              - generic [ref=e180]:
                - generic: ✕
              - text: Hit
            - listitem [ref=e181]:
              - generic [ref=e182]:
                - generic: ✖
              - text: Sunk
        - status [ref=e184]:
          - generic [ref=e185]:
            - generic [ref=e186]: "Blue fleet: avery. Red fleet: jordan_plays."
            - text: You fired at G2 and hit. Red fleet is firing.
        - generic [ref=e194]:
          - img "Blue fleet" [ref=e195]
          - generic [ref=e196]: avery
      - region "Game record" [ref=e198]:
        - generic [ref=e199]:
          - heading "Game record" [level=2] [ref=e201]
          - paragraph [ref=e202]: You fired at G2 and hit. Red fleet is firing.
        - generic [ref=e203]:
          - list "Moves played" [ref=e205]:
            - listitem [ref=e206]:
              - generic [ref=e207]: "1"
              - 'button "Move 1, Blue fleet: F10 hit" [ref=e210] [cursor=pointer]': F10 hit
              - 'button "Move 2, Red fleet: A2 miss" [ref=e213] [cursor=pointer]': A2 miss
            - listitem [ref=e214]:
              - generic [ref=e215]: "2"
              - 'button "Move 3, Blue fleet: G10 sinks the destroyer" [ref=e218] [cursor=pointer]': G10 sinks the destroyer
              - 'button "Move 4, Red fleet: B9 hit" [ref=e221] [cursor=pointer]': B9 hit
            - listitem [ref=e222]:
              - generic [ref=e223]: "3"
              - 'button "Move 5, Blue fleet: F2 hit" [ref=e226] [cursor=pointer]': F2 hit
              - 'button "Move 6, Red fleet: A1 hit" [ref=e229] [cursor=pointer]': A1 hit
            - listitem [ref=e230]:
              - generic [ref=e231]: "4"
              - 'button "Move 7, Blue fleet: G2 hit" [ref=e234] [cursor=pointer]': G2 hit
          - generic [ref=e235]:
            - generic [ref=e236]:
              - button "Go to the start" [ref=e237] [cursor=pointer]:
                - img [ref=e240]
              - button "Previous move" [ref=e243] [cursor=pointer]:
                - img [ref=e246]
              - button "Next move" [disabled] [ref=e248]:
                - img [ref=e251]
              - button "Return to current position" [ref=e253] [cursor=pointer]:
                - img [ref=e256]
            - button "Go to move" [ref=e259] [cursor=pointer]:
              - generic [ref=e261]:
                - paragraph [ref=e262]: Go to move
                - img [ref=e265]
        - generic [ref=e268]:
          - group "Game actions" [ref=e269]:
            - button "Resign game" [ref=e270] [cursor=pointer]:
              - paragraph [ref=e273]:
                - text: Resign
                - generic [ref=e274]: game
          - button "History and stats" [ref=e275] [cursor=pointer]:
            - paragraph [ref=e278]: History and stats
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