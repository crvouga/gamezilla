# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--precise-coordinates dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/precise-coordinates-dark.png.
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - generic [ref=e12]:
      - button "Spaces" [ref=e14] [cursor=pointer]:
        - img [ref=e17]
      - generic [ref=e21]:
        - paragraph [ref=e22]: Spaces
        - paragraph [ref=e23]: Friday game night
      - generic [ref=e25]:
        - button "2 people in this space" [ref=e27] [cursor=pointer]:
          - img [ref=e31]
        - button "More" [ref=e37] [cursor=pointer]:
          - img [ref=e40]
      - button "Account menu" [ref=e45] [cursor=pointer]
    - generic [ref=e50]:
      - generic [ref=e51]:
        - heading "Classic Quoridor" [level=1] [ref=e54]
        - generic [ref=e56]:
          - generic [ref=e57]: Unrated
          - generic [ref=e58]: ·Untimed
      - generic [ref=e59]:
        - generic [ref=e62]:
          - paragraph [ref=e64]: Your turn. Reach row 9.
          - paragraph [ref=e69]: No moves yet.
          - button "All moves" [ref=e70] [cursor=pointer]:
            - img [ref=e74]
        - generic [ref=e76]:
          - generic [ref=e78]:
            - generic [ref=e80]:
              - generic [ref=e85]:
                - img "North gold diamond" [ref=e86]:
                  - generic [ref=e87]: ◆
                - generic "jordan_plays" [ref=e90]
              - generic [ref=e91]: Walls 9
            - generic [ref=e93]:
              - group "Quoridor board, nine columns and nine rows" [ref=e94]:
                - generic [ref=e96]: a
                - generic [ref=e97]: b
                - generic [ref=e98]: c
                - generic [ref=e99]: d
                - generic [ref=e100]: e
                - generic [ref=e101]: f
                - generic [ref=e102]: g
                - generic [ref=e103]: h
                - generic [ref=e104]: i
                - generic [ref=e105]: "9"
                - 'button "a9: Empty, goal edge" [disabled] [ref=e106]'
                - 'button "b9: Empty, goal edge" [disabled] [ref=e107]'
                - 'button "c9: Empty, goal edge" [disabled] [ref=e108]'
                - 'button "d9: Empty, goal edge" [disabled] [ref=e109]'
                - 'button "e9: North gold diamond, goal edge" [disabled] [ref=e110]':
                  - generic: ◆
                - 'button "f9: Empty, goal edge" [disabled] [ref=e111]'
                - 'button "g9: Empty, goal edge" [disabled] [ref=e112]'
                - 'button "h9: Empty, goal edge" [disabled] [ref=e113]'
                - 'button "i9: Empty, goal edge" [disabled] [ref=e114]'
                - generic [ref=e115]: "8"
                - 'button "a8: Empty" [ref=e116] [cursor=pointer]'
                - 'button "b8: Empty" [ref=e117] [cursor=pointer]'
                - 'button "c8: Empty" [ref=e118] [cursor=pointer]'
                - 'button "d8: Empty" [ref=e119] [cursor=pointer]'
                - 'button "e8: Empty" [ref=e120] [cursor=pointer]'
                - 'button "f8: Empty" [ref=e121] [cursor=pointer]'
                - 'button "g8: Empty" [ref=e122] [cursor=pointer]'
                - 'button "h8: Empty" [ref=e123] [cursor=pointer]'
                - 'button "i8: Empty" [disabled] [ref=e124]'
                - generic [ref=e125]: "7"
                - 'button "a7: Empty" [ref=e126] [cursor=pointer]'
                - 'button "b7: Empty" [ref=e127] [cursor=pointer]'
                - 'button "c7: Empty" [ref=e128] [cursor=pointer]'
                - 'button "d7: Empty" [ref=e129] [cursor=pointer]'
                - 'button "e7: Empty" [ref=e130] [cursor=pointer]'
                - 'button "f7: Empty" [ref=e131] [cursor=pointer]'
                - 'button "g7: Empty" [ref=e132] [cursor=pointer]'
                - 'button "h7: Empty" [ref=e133] [cursor=pointer]'
                - 'button "i7: Empty" [disabled] [ref=e134]'
                - generic [ref=e135]: "6"
                - 'button "a6: Empty" [ref=e136] [cursor=pointer]'
                - 'button "b6: Empty" [ref=e137] [cursor=pointer]'
                - 'button "c6: Empty" [ref=e138] [cursor=pointer]'
                - 'button "d6: Empty" [ref=e139] [cursor=pointer]'
                - 'button "e6: Empty" [ref=e140] [cursor=pointer]'
                - 'button "f6: Empty" [ref=e141] [cursor=pointer]'
                - 'button "g6: Empty" [ref=e142] [cursor=pointer]'
                - 'button "h6: Empty" [ref=e143] [cursor=pointer]'
                - 'button "i6: Empty" [disabled] [ref=e144]'
                - generic [ref=e145]: "5"
                - 'button "a5: Empty" [ref=e146] [cursor=pointer]'
                - 'button "b5: Empty" [ref=e147] [cursor=pointer]'
                - 'button "c5: Empty" [ref=e148] [cursor=pointer]'
                - 'button "d5: Empty, wall boundaries: bottom" [ref=e149] [cursor=pointer]'
                - 'button "e5: Empty, wall boundaries: bottom" [ref=e150] [cursor=pointer]'
                - 'button "f5: Empty" [ref=e151] [cursor=pointer]'
                - 'button "g5: Empty" [ref=e152] [cursor=pointer]'
                - 'button "h5: Empty" [ref=e153] [cursor=pointer]'
                - 'button "i5: Empty" [disabled] [ref=e154]'
                - generic [ref=e155]: "4"
                - 'button "a4: Empty" [ref=e156] [cursor=pointer]'
                - 'button "b4: Empty" [ref=e157] [cursor=pointer]'
                - 'button "c4: Empty" [ref=e158] [cursor=pointer]'
                - 'button "d4: Empty, wall boundaries: top" [ref=e159] [cursor=pointer]'
                - 'button "e4: Empty, wall boundaries: top" [ref=e160] [cursor=pointer]'
                - 'button "f4: Empty" [ref=e161] [cursor=pointer]'
                - 'button "g4: Empty" [ref=e162] [cursor=pointer]'
                - 'button "h4: Empty" [ref=e163] [cursor=pointer]'
                - 'button "i4: Empty" [disabled] [ref=e164]'
                - generic [ref=e165]: "3"
                - 'button "a3: Empty" [ref=e166] [cursor=pointer]'
                - 'button "b3: Empty" [ref=e167] [cursor=pointer]'
                - 'button "c3: Empty" [ref=e168] [cursor=pointer]'
                - 'button "d3: Empty" [ref=e169] [cursor=pointer]'
                - 'button "e3: Empty" [ref=e170] [cursor=pointer]'
                - 'button "f3: Empty" [ref=e171] [cursor=pointer]'
                - 'button "g3: Empty" [ref=e172] [cursor=pointer]'
                - 'button "h3: Empty" [ref=e173] [cursor=pointer]'
                - 'button "i3: Empty" [disabled] [ref=e174]'
                - generic [ref=e175]: "2"
                - 'button "a2: Empty" [ref=e176] [cursor=pointer]'
                - 'button "b2: Empty" [ref=e177] [cursor=pointer]'
                - 'button "c2: Empty" [ref=e178] [cursor=pointer]'
                - 'button "d2: Empty" [ref=e179] [cursor=pointer]'
                - 'button "e2: South red circle" [ref=e180] [cursor=pointer]':
                  - generic: ●
                - 'button "f2: Empty" [ref=e181] [cursor=pointer]'
                - 'button "g2: Empty" [ref=e182] [cursor=pointer]'
                - 'button "h2: Empty" [ref=e183] [cursor=pointer]'
                - 'button "i2: Empty" [disabled] [ref=e184]'
                - generic [ref=e185]: "1"
                - 'button "a1: Empty" [ref=e186] [cursor=pointer]'
                - 'button "b1: Empty" [ref=e187] [cursor=pointer]'
                - 'button "c1: Empty" [ref=e188] [cursor=pointer]'
                - 'button "d1: Empty" [ref=e189] [cursor=pointer]'
                - 'button "e1: Empty" [ref=e190] [cursor=pointer]'
                - 'button "f1: Empty" [ref=e191] [cursor=pointer]'
                - 'button "g1: Empty" [ref=e192] [cursor=pointer]'
                - 'button "h1: Empty" [ref=e193] [cursor=pointer]'
                - 'button "i1: Empty" [disabled] [ref=e194]'
              - generic [ref=e195]:
                - button "Move pawn" [ref=e196] [cursor=pointer]:
                  - paragraph [ref=e199]: Move
                - button "Horizontal wall" [pressed] [ref=e200] [cursor=pointer]:
                  - paragraph [ref=e203]: Horizontal wall
                - button "Vertical wall" [ref=e204] [cursor=pointer]:
                  - paragraph [ref=e207]: Vertical wall
              - button "Wall starts above a square" [ref=e209] [cursor=pointer]:
                - paragraph [ref=e210]: Choose wall anchor
                - img [ref=e212]
              - status [ref=e214]: "Tap a square: preview a wall above it."
            - status [ref=e216]:
              - generic [ref=e217]:
                - generic [ref=e218]: "South red circle: avery. North gold diamond: jordan_plays."
                - text: Your turn. Reach row 9.
            - generic [ref=e221]:
              - generic [ref=e226]:
                - img "South red circle" [ref=e227]:
                  - generic [ref=e228]: ●
                - generic "avery" [ref=e231]
                - generic [ref=e232]: Your move
              - generic [ref=e233]: Walls 10
          - generic [ref=e236]:
            - group "Game actions" [ref=e237]:
              - button "Offer draw" [ref=e238] [cursor=pointer]:
                - paragraph [ref=e241]: Offer draw
              - button "Resign game" [ref=e242] [cursor=pointer]:
                - paragraph [ref=e245]:
                  - text: Resign
                  - generic [ref=e246]: game
            - button "History and stats" [ref=e247] [cursor=pointer]:
              - generic [ref=e249]:
                - paragraph [ref=e250]: History and stats
                - img [ref=e253]
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/precise-coordinates-dark.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```