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
  99816 pixels (ratio 0.09 of all image pixels) are different.

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
  - 99816 pixels (ratio 0.09 of all image pixels) are different.
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
  - 99816 pixels (ratio 0.09 of all image pixels) are different.

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
              - generic "jordan_plays" [ref=e38]
            - generic [ref=e41]: Destroyer sunk
          - generic [ref=e43]:
            - generic [ref=e45]:
              - radiogroup "Boards" [ref=e47]:
                - radio "Blue fleet waters" [checked] [ref=e48] [cursor=pointer]:
                  - generic [ref=e49]: Blue fleet waters
                - radio "Red fleet waters" [ref=e50] [cursor=pointer]:
                  - generic [ref=e51]: Red fleet waters
              - region "Blue fleet waters" [ref=e52]:
                - group "Blue fleet waters" [ref=e53]:
                  - generic [ref=e55]: A
                  - generic [ref=e56]: B
                  - generic [ref=e57]: C
                  - generic [ref=e58]: D
                  - generic [ref=e59]: E
                  - generic [ref=e60]: F
                  - generic [ref=e61]: G
                  - generic [ref=e62]: H
                  - generic [ref=e63]: I
                  - generic [ref=e64]: J
                  - generic [ref=e65]: "1"
                  - 'button "A1: hit" [disabled] [ref=e66]':
                    - generic: ✕
                  - 'button "B1: not fired at" [disabled] [ref=e67]'
                  - 'button "C1: not fired at" [disabled] [ref=e68]'
                  - 'button "D1: not fired at" [disabled] [ref=e69]'
                  - 'button "E1: not fired at" [disabled] [ref=e70]'
                  - 'button "F1: not fired at" [disabled] [ref=e71]'
                  - 'button "G1: not fired at" [disabled] [ref=e72]'
                  - 'button "H1: not fired at" [disabled] [ref=e73]'
                  - 'button "I1: not fired at" [disabled] [ref=e74]'
                  - 'button "J1: not fired at" [disabled] [ref=e75]'
                  - generic [ref=e76]: "2"
                  - 'button "A2: miss" [disabled] [ref=e77]':
                    - generic: ○
                  - 'button "B2: not fired at" [disabled] [ref=e78]'
                  - 'button "C2: not fired at" [disabled] [ref=e79]'
                  - 'button "D2: not fired at" [disabled] [ref=e80]'
                  - 'button "E2: not fired at" [disabled] [ref=e81]'
                  - 'button "F2: not fired at" [disabled] [ref=e82]'
                  - 'button "G2: not fired at" [disabled] [ref=e83]'
                  - 'button "H2: not fired at" [disabled] [ref=e84]'
                  - 'button "I2: not fired at" [disabled] [ref=e85]'
                  - 'button "J2: not fired at" [disabled] [ref=e86]'
                  - generic [ref=e87]: "3"
                  - 'button "A3: not fired at" [disabled] [ref=e88]'
                  - 'button "B3: not fired at" [disabled] [ref=e89]'
                  - 'button "C3: not fired at" [disabled] [ref=e90]'
                  - 'button "D3: not fired at" [disabled] [ref=e91]'
                  - 'button "E3: not fired at" [disabled] [ref=e92]'
                  - 'button "F3: not fired at" [disabled] [ref=e93]'
                  - 'button "G3: not fired at" [disabled] [ref=e94]'
                  - 'button "H3: not fired at" [disabled] [ref=e95]'
                  - 'button "I3: not fired at" [disabled] [ref=e96]'
                  - 'button "J3: not fired at" [disabled] [ref=e97]'
                  - generic [ref=e98]: "4"
                  - 'button "A4: not fired at" [disabled] [ref=e99]'
                  - 'button "B4: not fired at" [disabled] [ref=e100]'
                  - 'button "C4: miss, latest shot" [disabled] [ref=e101]':
                    - generic: ○
                  - 'button "D4: not fired at" [disabled] [ref=e102]'
                  - 'button "E4: not fired at" [disabled] [ref=e103]'
                  - 'button "F4: not fired at" [disabled] [ref=e104]'
                  - 'button "G4: not fired at" [disabled] [ref=e105]'
                  - 'button "H4: not fired at" [disabled] [ref=e106]'
                  - 'button "I4: not fired at" [disabled] [ref=e107]'
                  - 'button "J4: not fired at" [disabled] [ref=e108]'
                  - generic [ref=e109]: "5"
                  - 'button "A5: not fired at" [disabled] [ref=e110]'
                  - 'button "B5: not fired at" [disabled] [ref=e111]'
                  - 'button "C5: not fired at" [disabled] [ref=e112]'
                  - 'button "D5: not fired at" [disabled] [ref=e113]'
                  - 'button "E5: not fired at" [disabled] [ref=e114]'
                  - 'button "F5: not fired at" [disabled] [ref=e115]'
                  - 'button "G5: not fired at" [disabled] [ref=e116]'
                  - 'button "H5: not fired at" [disabled] [ref=e117]'
                  - 'button "I5: not fired at" [disabled] [ref=e118]'
                  - 'button "J5: not fired at" [disabled] [ref=e119]'
                  - generic [ref=e120]: "6"
                  - 'button "A6: not fired at" [disabled] [ref=e121]'
                  - 'button "B6: not fired at" [disabled] [ref=e122]'
                  - 'button "C6: not fired at" [disabled] [ref=e123]'
                  - 'button "D6: not fired at" [disabled] [ref=e124]'
                  - 'button "E6: not fired at" [disabled] [ref=e125]'
                  - 'button "F6: not fired at" [disabled] [ref=e126]'
                  - 'button "G6: not fired at" [disabled] [ref=e127]'
                  - 'button "H6: not fired at" [disabled] [ref=e128]'
                  - 'button "I6: not fired at" [disabled] [ref=e129]'
                  - 'button "J6: not fired at" [disabled] [ref=e130]'
                  - generic [ref=e131]: "7"
                  - 'button "A7: not fired at" [disabled] [ref=e132]'
                  - 'button "B7: not fired at" [disabled] [ref=e133]'
                  - 'button "C7: not fired at" [disabled] [ref=e134]'
                  - 'button "D7: not fired at" [disabled] [ref=e135]'
                  - 'button "E7: not fired at" [disabled] [ref=e136]'
                  - 'button "F7: not fired at" [disabled] [ref=e137]'
                  - 'button "G7: not fired at" [disabled] [ref=e138]'
                  - 'button "H7: not fired at" [disabled] [ref=e139]'
                  - 'button "I7: not fired at" [disabled] [ref=e140]'
                  - 'button "J7: not fired at" [disabled] [ref=e141]'
                  - generic [ref=e142]: "8"
                  - 'button "A8: not fired at" [disabled] [ref=e143]'
                  - 'button "B8: not fired at" [disabled] [ref=e144]'
                  - 'button "C8: not fired at" [disabled] [ref=e145]'
                  - 'button "D8: not fired at" [disabled] [ref=e146]'
                  - 'button "E8: not fired at" [disabled] [ref=e147]'
                  - 'button "F8: not fired at" [disabled] [ref=e148]'
                  - 'button "G8: not fired at" [disabled] [ref=e149]'
                  - 'button "H8: not fired at" [disabled] [ref=e150]'
                  - 'button "I8: not fired at" [disabled] [ref=e151]'
                  - 'button "J8: not fired at" [disabled] [ref=e152]'
                  - generic [ref=e153]: "9"
                  - 'button "A9: not fired at" [disabled] [ref=e154]'
                  - 'button "B9: hit" [disabled] [ref=e155]':
                    - generic: ✕
                  - 'button "C9: not fired at" [disabled] [ref=e156]'
                  - 'button "D9: not fired at" [disabled] [ref=e157]'
                  - 'button "E9: not fired at" [disabled] [ref=e158]'
                  - 'button "F9: not fired at" [disabled] [ref=e159]'
                  - 'button "G9: not fired at" [disabled] [ref=e160]'
                  - 'button "H9: not fired at" [disabled] [ref=e161]'
                  - 'button "I9: not fired at" [disabled] [ref=e162]'
                  - 'button "J9: not fired at" [disabled] [ref=e163]'
                  - generic [ref=e164]: "10"
                  - 'button "A10: not fired at" [disabled] [ref=e165]'
                  - 'button "B10: not fired at" [disabled] [ref=e166]'
                  - 'button "C10: not fired at" [disabled] [ref=e167]'
                  - 'button "D10: not fired at" [disabled] [ref=e168]'
                  - 'button "E10: not fired at" [disabled] [ref=e169]'
                  - 'button "F10: not fired at" [disabled] [ref=e170]'
                  - 'button "G10: not fired at" [disabled] [ref=e171]'
                  - 'button "H10: not fired at" [disabled] [ref=e172]'
                  - 'button "I10: not fired at" [disabled] [ref=e173]'
                  - 'button "J10: not fired at" [disabled] [ref=e174]'
            - list "Key" [ref=e175]:
              - listitem [ref=e176]:
                - generic [ref=e177]:
                  - generic: ○
                - text: Miss
              - listitem [ref=e178]:
                - generic [ref=e179]:
                  - generic: ✕
                - text: Hit
              - listitem [ref=e180]:
                - generic [ref=e181]:
                  - generic: ✖
                - text: Sunk
          - status [ref=e183]:
            - generic [ref=e184]:
              - generic [ref=e185]: "Blue fleet: avery. Red fleet: jordan_plays."
              - text: Red fleet fired at C4 and missed. Blue fleet to fire.
          - generic [ref=e193]:
            - img "Blue fleet" [ref=e194]
            - generic "avery" [ref=e197]
            - generic [ref=e198]: To move
        - region "Game record" [ref=e200]:
          - generic [ref=e201]:
            - heading "Game record" [level=2] [ref=e203]
            - paragraph [ref=e204]: Red fleet fired at C4 and missed. Blue fleet to fire.
          - generic [ref=e205]:
            - list "Moves played" [ref=e207]:
              - listitem [ref=e208]:
                - generic [ref=e209]: "1"
                - 'button "Move 1, Blue fleet: F10 hit" [ref=e212] [cursor=pointer]': F10 hit
                - 'button "Move 2, Red fleet: A2 miss" [ref=e215] [cursor=pointer]': A2 miss
              - listitem [ref=e216]:
                - generic [ref=e217]: "2"
                - 'button "Move 3, Blue fleet: G10 sinks the destroyer" [ref=e220] [cursor=pointer]': G10 sinks the destroyer
                - 'button "Move 4, Red fleet: B9 hit" [ref=e223] [cursor=pointer]': B9 hit
              - listitem [ref=e224]:
                - generic [ref=e225]: "3"
                - 'button "Move 5, Blue fleet: F2 hit" [ref=e228] [cursor=pointer]': F2 hit
                - 'button "Move 6, Red fleet: A1 hit" [ref=e231] [cursor=pointer]': A1 hit
              - listitem [ref=e232]:
                - generic [ref=e233]: "4"
                - 'button "Move 7, Blue fleet: G2 hit" [ref=e236] [cursor=pointer]': G2 hit
                - 'button "Move 8, Red fleet: C4 miss" [ref=e239] [cursor=pointer]': C4 miss
            - generic [ref=e240]:
              - generic [ref=e241]:
                - button "Go to the start" [ref=e242] [cursor=pointer]:
                  - img [ref=e245]
                - button "Previous move" [ref=e248] [cursor=pointer]:
                  - img [ref=e251]
                - button "Next move" [disabled] [ref=e253]:
                  - img [ref=e256]
                - button "Return to current position" [ref=e258] [cursor=pointer]:
                  - img [ref=e261]
              - button "Go to move" [ref=e264] [cursor=pointer]:
                - generic [ref=e266]:
                  - paragraph [ref=e267]: Go to move
                  - img [ref=e270]
          - button "History and stats" [ref=e274] [cursor=pointer]:
            - paragraph [ref=e277]: History and stats
      - generic [ref=e278]:
        - img [ref=e281]
        - generic [ref=e284]:
          - paragraph [ref=e285]: You're watching
          - paragraph [ref=e286]: Moves appear as they are played.
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