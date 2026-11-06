# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-board--watching light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  1385 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/watching-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-board/watching-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 1385 pixels (ratio 0.01 of all image pixels) are different.
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
  - 1385 pixels (ratio 0.01 of all image pixels) are different.

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
    - generic [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e27]:
          - generic [ref=e33]:
            - generic [ref=e34]:
              - img "Red fleet" [ref=e35]
              - generic [ref=e36]: jordan_plays
            - generic [ref=e39]: Destroyer sunk
          - generic [ref=e41]:
            - generic [ref=e43]:
              - radiogroup "Boards" [ref=e45]:
                - radio "Blue fleet waters" [checked] [ref=e46] [cursor=pointer]:
                  - generic [ref=e47]: Blue fleet waters
                - radio "Red fleet waters" [ref=e48] [cursor=pointer]:
                  - generic [ref=e49]: Red fleet waters
              - region "Blue fleet waters" [ref=e50]:
                - group "Blue fleet waters" [ref=e51]:
                  - generic [ref=e53]: A
                  - generic [ref=e54]: B
                  - generic [ref=e55]: C
                  - generic [ref=e56]: D
                  - generic [ref=e57]: E
                  - generic [ref=e58]: F
                  - generic [ref=e59]: G
                  - generic [ref=e60]: H
                  - generic [ref=e61]: I
                  - generic [ref=e62]: J
                  - generic [ref=e63]: "1"
                  - 'button "A1: hit" [disabled] [ref=e64]':
                    - generic: ✕
                  - 'button "B1: not fired at" [disabled] [ref=e65]'
                  - 'button "C1: not fired at" [disabled] [ref=e66]'
                  - 'button "D1: not fired at" [disabled] [ref=e67]'
                  - 'button "E1: not fired at" [disabled] [ref=e68]'
                  - 'button "F1: not fired at" [disabled] [ref=e69]'
                  - 'button "G1: not fired at" [disabled] [ref=e70]'
                  - 'button "H1: not fired at" [disabled] [ref=e71]'
                  - 'button "I1: not fired at" [disabled] [ref=e72]'
                  - 'button "J1: not fired at" [disabled] [ref=e73]'
                  - generic [ref=e74]: "2"
                  - 'button "A2: miss" [disabled] [ref=e75]':
                    - generic: ○
                  - 'button "B2: not fired at" [disabled] [ref=e76]'
                  - 'button "C2: not fired at" [disabled] [ref=e77]'
                  - 'button "D2: not fired at" [disabled] [ref=e78]'
                  - 'button "E2: not fired at" [disabled] [ref=e79]'
                  - 'button "F2: not fired at" [disabled] [ref=e80]'
                  - 'button "G2: not fired at" [disabled] [ref=e81]'
                  - 'button "H2: not fired at" [disabled] [ref=e82]'
                  - 'button "I2: not fired at" [disabled] [ref=e83]'
                  - 'button "J2: not fired at" [disabled] [ref=e84]'
                  - generic [ref=e85]: "3"
                  - 'button "A3: not fired at" [disabled] [ref=e86]'
                  - 'button "B3: not fired at" [disabled] [ref=e87]'
                  - 'button "C3: not fired at" [disabled] [ref=e88]'
                  - 'button "D3: not fired at" [disabled] [ref=e89]'
                  - 'button "E3: not fired at" [disabled] [ref=e90]'
                  - 'button "F3: not fired at" [disabled] [ref=e91]'
                  - 'button "G3: not fired at" [disabled] [ref=e92]'
                  - 'button "H3: not fired at" [disabled] [ref=e93]'
                  - 'button "I3: not fired at" [disabled] [ref=e94]'
                  - 'button "J3: not fired at" [disabled] [ref=e95]'
                  - generic [ref=e96]: "4"
                  - 'button "A4: not fired at" [disabled] [ref=e97]'
                  - 'button "B4: not fired at" [disabled] [ref=e98]'
                  - 'button "C4: miss, latest shot" [disabled] [ref=e99]':
                    - generic: ○
                  - 'button "D4: not fired at" [disabled] [ref=e100]'
                  - 'button "E4: not fired at" [disabled] [ref=e101]'
                  - 'button "F4: not fired at" [disabled] [ref=e102]'
                  - 'button "G4: not fired at" [disabled] [ref=e103]'
                  - 'button "H4: not fired at" [disabled] [ref=e104]'
                  - 'button "I4: not fired at" [disabled] [ref=e105]'
                  - 'button "J4: not fired at" [disabled] [ref=e106]'
                  - generic [ref=e107]: "5"
                  - 'button "A5: not fired at" [disabled] [ref=e108]'
                  - 'button "B5: not fired at" [disabled] [ref=e109]'
                  - 'button "C5: not fired at" [disabled] [ref=e110]'
                  - 'button "D5: not fired at" [disabled] [ref=e111]'
                  - 'button "E5: not fired at" [disabled] [ref=e112]'
                  - 'button "F5: not fired at" [disabled] [ref=e113]'
                  - 'button "G5: not fired at" [disabled] [ref=e114]'
                  - 'button "H5: not fired at" [disabled] [ref=e115]'
                  - 'button "I5: not fired at" [disabled] [ref=e116]'
                  - 'button "J5: not fired at" [disabled] [ref=e117]'
                  - generic [ref=e118]: "6"
                  - 'button "A6: not fired at" [disabled] [ref=e119]'
                  - 'button "B6: not fired at" [disabled] [ref=e120]'
                  - 'button "C6: not fired at" [disabled] [ref=e121]'
                  - 'button "D6: not fired at" [disabled] [ref=e122]'
                  - 'button "E6: not fired at" [disabled] [ref=e123]'
                  - 'button "F6: not fired at" [disabled] [ref=e124]'
                  - 'button "G6: not fired at" [disabled] [ref=e125]'
                  - 'button "H6: not fired at" [disabled] [ref=e126]'
                  - 'button "I6: not fired at" [disabled] [ref=e127]'
                  - 'button "J6: not fired at" [disabled] [ref=e128]'
                  - generic [ref=e129]: "7"
                  - 'button "A7: not fired at" [disabled] [ref=e130]'
                  - 'button "B7: not fired at" [disabled] [ref=e131]'
                  - 'button "C7: not fired at" [disabled] [ref=e132]'
                  - 'button "D7: not fired at" [disabled] [ref=e133]'
                  - 'button "E7: not fired at" [disabled] [ref=e134]'
                  - 'button "F7: not fired at" [disabled] [ref=e135]'
                  - 'button "G7: not fired at" [disabled] [ref=e136]'
                  - 'button "H7: not fired at" [disabled] [ref=e137]'
                  - 'button "I7: not fired at" [disabled] [ref=e138]'
                  - 'button "J7: not fired at" [disabled] [ref=e139]'
                  - generic [ref=e140]: "8"
                  - 'button "A8: not fired at" [disabled] [ref=e141]'
                  - 'button "B8: not fired at" [disabled] [ref=e142]'
                  - 'button "C8: not fired at" [disabled] [ref=e143]'
                  - 'button "D8: not fired at" [disabled] [ref=e144]'
                  - 'button "E8: not fired at" [disabled] [ref=e145]'
                  - 'button "F8: not fired at" [disabled] [ref=e146]'
                  - 'button "G8: not fired at" [disabled] [ref=e147]'
                  - 'button "H8: not fired at" [disabled] [ref=e148]'
                  - 'button "I8: not fired at" [disabled] [ref=e149]'
                  - 'button "J8: not fired at" [disabled] [ref=e150]'
                  - generic [ref=e151]: "9"
                  - 'button "A9: not fired at" [disabled] [ref=e152]'
                  - 'button "B9: hit" [disabled] [ref=e153]':
                    - generic: ✕
                  - 'button "C9: not fired at" [disabled] [ref=e154]'
                  - 'button "D9: not fired at" [disabled] [ref=e155]'
                  - 'button "E9: not fired at" [disabled] [ref=e156]'
                  - 'button "F9: not fired at" [disabled] [ref=e157]'
                  - 'button "G9: not fired at" [disabled] [ref=e158]'
                  - 'button "H9: not fired at" [disabled] [ref=e159]'
                  - 'button "I9: not fired at" [disabled] [ref=e160]'
                  - 'button "J9: not fired at" [disabled] [ref=e161]'
                  - generic [ref=e162]: "10"
                  - 'button "A10: not fired at" [disabled] [ref=e163]'
                  - 'button "B10: not fired at" [disabled] [ref=e164]'
                  - 'button "C10: not fired at" [disabled] [ref=e165]'
                  - 'button "D10: not fired at" [disabled] [ref=e166]'
                  - 'button "E10: not fired at" [disabled] [ref=e167]'
                  - 'button "F10: not fired at" [disabled] [ref=e168]'
                  - 'button "G10: not fired at" [disabled] [ref=e169]'
                  - 'button "H10: not fired at" [disabled] [ref=e170]'
                  - 'button "I10: not fired at" [disabled] [ref=e171]'
                  - 'button "J10: not fired at" [disabled] [ref=e172]'
            - list "Key" [ref=e173]:
              - listitem [ref=e174]:
                - generic [ref=e175]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e176]:
                - generic [ref=e177]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e178]:
                - generic [ref=e179]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e181]:
            - generic [ref=e182]:
              - generic [ref=e183]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Red fleet fired at C4 and missed. Blue fleet to fire.
          - generic [ref=e191]:
            - img "Blue fleet" [ref=e192]
            - generic [ref=e193]: avery
            - generic [ref=e194]: To move
        - region "Game record" [ref=e196]:
          - generic [ref=e197]:
            - heading "Game record" [level=2] [ref=e199]
            - paragraph [ref=e200]: Red fleet fired at C4 and missed. Blue fleet to fire.
          - generic [ref=e201]:
            - list "Moves played" [ref=e203]:
              - listitem [ref=e204]:
                - generic [ref=e205]: "1"
                - 'button "Move 1, Blue fleet: F10 hit" [ref=e208] [cursor=pointer]': F10 hit
                - 'button "Move 2, Red fleet: A2 miss" [ref=e211] [cursor=pointer]': A2 miss
              - listitem [ref=e212]:
                - generic [ref=e213]: "2"
                - 'button "Move 3, Blue fleet: G10 sinks the destroyer" [ref=e216] [cursor=pointer]': G10 sinks the destroyer
                - 'button "Move 4, Red fleet: B9 hit" [ref=e219] [cursor=pointer]': B9 hit
              - listitem [ref=e220]:
                - generic [ref=e221]: "3"
                - 'button "Move 5, Blue fleet: F2 hit" [ref=e224] [cursor=pointer]': F2 hit
                - 'button "Move 6, Red fleet: A1 hit" [ref=e227] [cursor=pointer]': A1 hit
              - listitem [ref=e228]:
                - generic [ref=e229]: "4"
                - 'button "Move 7, Blue fleet: G2 hit" [ref=e232] [cursor=pointer]': G2 hit
                - 'button "Move 8, Red fleet: C4 miss" [ref=e235] [cursor=pointer]': C4 miss
            - generic [ref=e236]:
              - generic [ref=e237]:
                - button "Go to the start" [ref=e238] [cursor=pointer]:
                  - img [ref=e241]
                - button "Previous move" [ref=e244] [cursor=pointer]:
                  - img [ref=e247]
                - button "Next move" [disabled] [ref=e249]:
                  - img [ref=e252]
                - button "Return to current position" [ref=e254] [cursor=pointer]:
                  - img [ref=e257]
              - button "Go to move" [ref=e260] [cursor=pointer]:
                - generic [ref=e262]:
                  - paragraph [ref=e263]: Go to move
                  - img [ref=e266]
          - button "History and stats" [ref=e270] [cursor=pointer]:
            - paragraph [ref=e273]: History and stats
      - generic [ref=e274]:
        - img [ref=e277]
        - generic [ref=e280]:
          - paragraph [ref=e281]: You're watching
          - paragraph [ref=e282]: Moves appear as they are played.
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