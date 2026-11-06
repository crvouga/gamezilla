# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--watching light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  63887 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/watching-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/watching-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 63887 pixels (ratio 0.06 of all image pixels) are different.
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
  - 63887 pixels (ratio 0.06 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e15]:
    - generic [ref=e16]:
      - heading "Word Tiles" [level=1] [ref=e19]
      - generic [ref=e21]:
        - generic [ref=e22]: Unrated
        - generic [ref=e23]: ·Untimed
    - generic [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e27]:
          - generic [ref=e29]:
            - generic [ref=e33]:
              - generic [ref=e34]:
                - img "Teal" [ref=e35]
                - generic "jordan_plays" [ref=e38]
              - generic [ref=e41]: 7 tiles
            - generic [ref=e42]:
              - generic [ref=e43]: Score
              - generic [ref=e44]: "3"
          - generic [ref=e46]:
            - paragraph [ref=e47]: You are watching. Racks stay private to their players.
            - generic [ref=e48]:
              - generic [ref=e49]:
                - button "Fit board" [pressed] [ref=e50] [cursor=pointer]:
                  - paragraph [ref=e53]: Fit board
                - button "Enlarge board" [ref=e54] [cursor=pointer]:
                  - paragraph [ref=e57]: Enlarge board
              - region "Scrollable word board" [ref=e59]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e60]:
                  - generic [ref=e62]: a
                  - generic [ref=e63]: b
                  - generic [ref=e64]: c
                  - generic [ref=e65]: d
                  - generic [ref=e66]: e
                  - generic [ref=e67]: f
                  - generic [ref=e68]: g
                  - generic [ref=e69]: h
                  - generic [ref=e70]: i
                  - generic [ref=e71]: j
                  - generic [ref=e72]: k
                  - generic [ref=e73]: l
                  - generic [ref=e74]: m
                  - generic [ref=e75]: "n"
                  - generic [ref=e76]: o
                  - generic [ref=e77]: "1"
                  - button "2L, a1, double letter, empty" [disabled] [ref=e78]:
                    - generic [ref=e79]: 2L
                  - button "b1, empty" [disabled] [ref=e80]
                  - button "c1, empty" [disabled] [ref=e81]
                  - button "d1, empty" [disabled] [ref=e82]
                  - button "3W, e1, triple word, empty" [disabled] [ref=e83]:
                    - generic [ref=e84]: 3W
                  - button "f1, empty" [disabled] [ref=e85]
                  - button "g1, empty" [disabled] [ref=e86]
                  - button "2L, h1, double letter, empty" [disabled] [ref=e87]:
                    - generic [ref=e88]: 2L
                  - button "i1, empty" [disabled] [ref=e89]
                  - button "j1, empty" [disabled] [ref=e90]
                  - button "3W, k1, triple word, empty" [disabled] [ref=e91]:
                    - generic [ref=e92]: 3W
                  - button "l1, empty" [disabled] [ref=e93]
                  - button "m1, empty" [disabled] [ref=e94]
                  - button "n1, empty" [disabled] [ref=e95]
                  - button "2L, o1, double letter, empty" [disabled] [ref=e96]:
                    - generic [ref=e97]: 2L
                  - generic [ref=e98]: "2"
                  - button "a2, empty" [disabled] [ref=e99]
                  - button "b2, empty" [disabled] [ref=e100]
                  - button "c2, empty" [disabled] [ref=e101]
                  - button "2L, d2, double letter, empty" [disabled] [ref=e102]:
                    - generic [ref=e103]: 2L
                  - button "e2, empty" [disabled] [ref=e104]
                  - button "f2, empty" [disabled] [ref=e105]
                  - button "2W, g2, double word, empty" [disabled] [ref=e106]:
                    - generic [ref=e107]: 2W
                  - button "h2, empty" [disabled] [ref=e108]
                  - button "2W, i2, double word, empty" [disabled] [ref=e109]:
                    - generic [ref=e110]: 2W
                  - button "j2, empty" [disabled] [ref=e111]
                  - button "k2, empty" [disabled] [ref=e112]
                  - button "2L, l2, double letter, empty" [disabled] [ref=e113]:
                    - generic [ref=e114]: 2L
                  - button "m2, empty" [disabled] [ref=e115]
                  - button "n2, empty" [disabled] [ref=e116]
                  - button "o2, empty" [disabled] [ref=e117]
                  - generic [ref=e118]: "3"
                  - button "a3, empty" [disabled] [ref=e119]
                  - button "b3, empty" [disabled] [ref=e120]
                  - button "c3, empty" [disabled] [ref=e121]
                  - button "d3, empty" [disabled] [ref=e122]
                  - button "3L, e3, triple letter, empty" [disabled] [ref=e123]:
                    - generic [ref=e124]: 3L
                  - button "f3, empty" [disabled] [ref=e125]
                  - button "g3, empty" [disabled] [ref=e126]
                  - button "h3, empty" [disabled] [ref=e127]
                  - button "i3, empty" [disabled] [ref=e128]
                  - button "j3, empty" [disabled] [ref=e129]
                  - button "3L, k3, triple letter, empty" [disabled] [ref=e130]:
                    - generic [ref=e131]: 3L
                  - button "l3, empty" [disabled] [ref=e132]
                  - button "m3, empty" [disabled] [ref=e133]
                  - button "n3, empty" [disabled] [ref=e134]
                  - button "o3, empty" [disabled] [ref=e135]
                  - generic [ref=e136]: "4"
                  - button "a4, empty" [disabled] [ref=e137]
                  - button "2L, b4, double letter, empty" [disabled] [ref=e138]:
                    - generic [ref=e139]: 2L
                  - button "c4, empty" [disabled] [ref=e140]
                  - button "2W, d4, double word, empty" [disabled] [ref=e141]:
                    - generic [ref=e142]: 2W
                  - button "e4, empty" [disabled] [ref=e143]
                  - button "f4, empty" [disabled] [ref=e144]
                  - button "g4, empty" [disabled] [ref=e145]
                  - button "h4, empty" [disabled] [ref=e146]
                  - button "i4, empty" [disabled] [ref=e147]
                  - button "j4, empty" [disabled] [ref=e148]
                  - button "k4, empty" [disabled] [ref=e149]
                  - button "2W, l4, double word, empty" [disabled] [ref=e150]:
                    - generic [ref=e151]: 2W
                  - button "m4, empty" [disabled] [ref=e152]
                  - button "2L, n4, double letter, empty" [disabled] [ref=e153]:
                    - generic [ref=e154]: 2L
                  - button "o4, empty" [disabled] [ref=e155]
                  - generic [ref=e156]: "5"
                  - button "3W, a5, triple word, empty" [disabled] [ref=e157]:
                    - generic [ref=e158]: 3W
                  - button "b5, empty" [disabled] [ref=e159]
                  - button "3L, c5, triple letter, empty" [disabled] [ref=e160]:
                    - generic [ref=e161]: 3L
                  - button "d5, empty" [disabled] [ref=e162]
                  - button "e5, empty" [disabled] [ref=e163]
                  - button "f5, empty" [disabled] [ref=e164]
                  - button "2L, g5, double letter, empty" [disabled] [ref=e165]:
                    - generic [ref=e166]: 2L
                  - button "h5, empty" [disabled] [ref=e167]
                  - button "2L, i5, double letter, empty" [disabled] [ref=e168]:
                    - generic [ref=e169]: 2L
                  - button "j5, empty" [disabled] [ref=e170]
                  - button "k5, empty" [disabled] [ref=e171]
                  - button "l5, empty" [disabled] [ref=e172]
                  - button "3L, m5, triple letter, empty" [disabled] [ref=e173]:
                    - generic [ref=e174]: 3L
                  - button "n5, empty" [disabled] [ref=e175]
                  - button "3W, o5, triple word, empty" [disabled] [ref=e176]:
                    - generic [ref=e177]: 3W
                  - generic [ref=e178]: "6"
                  - button "a6, empty" [disabled] [ref=e179]
                  - button "b6, empty" [disabled] [ref=e180]
                  - button "c6, empty" [disabled] [ref=e181]
                  - button "d6, empty" [disabled] [ref=e182]
                  - button "e6, empty" [disabled] [ref=e183]
                  - button "f6, empty" [disabled] [ref=e184]
                  - button "g6, empty" [disabled] [ref=e185]
                  - button "3L, h6, triple letter, empty" [disabled] [ref=e186]:
                    - generic [ref=e187]: 3L
                  - button "i6, empty" [disabled] [ref=e188]
                  - button "j6, empty" [disabled] [ref=e189]
                  - button "k6, empty" [disabled] [ref=e190]
                  - button "l6, empty" [disabled] [ref=e191]
                  - button "m6, empty" [disabled] [ref=e192]
                  - button "n6, empty" [disabled] [ref=e193]
                  - button "o6, empty" [disabled] [ref=e194]
                  - generic [ref=e195]: "7"
                  - button "a7, empty" [disabled] [ref=e196]
                  - button "2W, b7, double word, empty" [disabled] [ref=e197]:
                    - generic [ref=e198]: 2W
                  - button "c7, empty" [disabled] [ref=e199]
                  - button "d7, empty" [disabled] [ref=e200]
                  - button "2L, e7, double letter, empty" [disabled] [ref=e201]:
                    - generic [ref=e202]: 2L
                  - button "f7, empty" [disabled] [ref=e203]
                  - button "2L, g7, double letter, empty" [disabled] [ref=e204]:
                    - generic [ref=e205]: 2L
                  - button "h7, empty" [disabled] [ref=e206]
                  - button "2L, i7, double letter, empty" [disabled] [ref=e207]:
                    - generic [ref=e208]: 2L
                  - button "j7, empty" [disabled] [ref=e209]
                  - button "2L, k7, double letter, empty" [disabled] [ref=e210]:
                    - generic [ref=e211]: 2L
                  - button "l7, empty" [disabled] [ref=e212]
                  - button "m7, empty" [disabled] [ref=e213]
                  - button "2W, n7, double word, empty" [disabled] [ref=e214]:
                    - generic [ref=e215]: 2W
                  - button "o7, empty" [disabled] [ref=e216]
                  - generic [ref=e217]: "8"
                  - button "2L, a8, double letter, empty" [disabled] [ref=e218]:
                    - generic [ref=e219]: 2L
                  - button "b8, empty" [disabled] [ref=e220]
                  - button "c8, empty" [disabled] [ref=e221]
                  - button "d8, empty" [disabled] [ref=e222]
                  - button "e8, empty" [disabled] [ref=e223]
                  - button "3L, f8, triple letter, empty" [disabled] [ref=e224]:
                    - generic [ref=e225]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e226]:
                    - generic [ref=e227]: C
                    - generic [ref=e228]: "3"
                  - button "A 1, h8, committed" [disabled] [ref=e229]:
                    - generic [ref=e230]: A
                    - generic [ref=e231]: "1"
                  - button "T 1, i8, committed" [disabled] [ref=e232]:
                    - generic [ref=e233]: T
                    - generic [ref=e234]: "1"
                  - button "3L, j8, triple letter, empty" [disabled] [ref=e235]:
                    - generic [ref=e236]: 3L
                  - button "k8, empty" [disabled] [ref=e237]
                  - button "l8, empty" [disabled] [ref=e238]
                  - button "m8, empty" [disabled] [ref=e239]
                  - button "n8, empty" [disabled] [ref=e240]
                  - button "2L, o8, double letter, empty" [disabled] [ref=e241]:
                    - generic [ref=e242]: 2L
                  - generic [ref=e243]: "9"
                  - button "a9, empty" [disabled] [ref=e244]
                  - button "2W, b9, double word, empty" [disabled] [ref=e245]:
                    - generic [ref=e246]: 2W
                  - button "c9, empty" [disabled] [ref=e247]
                  - button "d9, empty" [disabled] [ref=e248]
                  - button "2L, e9, double letter, empty" [disabled] [ref=e249]:
                    - generic [ref=e250]: 2L
                  - button "f9, empty" [disabled] [ref=e251]
                  - button "2L, g9, double letter, empty" [disabled] [ref=e252]:
                    - generic [ref=e253]: 2L
                  - button "h9, empty" [disabled] [ref=e254]
                  - button "O 1, i9, committed" [disabled] [ref=e255]:
                    - generic [ref=e256]: O
                    - generic [ref=e257]: "1"
                  - button "j9, empty" [disabled] [ref=e258]
                  - button "2L, k9, double letter, empty" [disabled] [ref=e259]:
                    - generic [ref=e260]: 2L
                  - button "l9, empty" [disabled] [ref=e261]
                  - button "m9, empty" [disabled] [ref=e262]
                  - button "2W, n9, double word, empty" [disabled] [ref=e263]:
                    - generic [ref=e264]: 2W
                  - button "o9, empty" [disabled] [ref=e265]
                  - generic [ref=e266]: "10"
                  - button "a10, empty" [disabled] [ref=e267]
                  - button "b10, empty" [disabled] [ref=e268]
                  - button "c10, empty" [disabled] [ref=e269]
                  - button "d10, empty" [disabled] [ref=e270]
                  - button "e10, empty" [disabled] [ref=e271]
                  - button "f10, empty" [disabled] [ref=e272]
                  - button "g10, empty" [disabled] [ref=e273]
                  - button "3L, h10, triple letter, empty" [disabled] [ref=e274]:
                    - generic [ref=e275]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e276]:
                    - generic [ref=e277]: E
                    - generic [ref=e278]: "1"
                  - button "j10, empty" [disabled] [ref=e279]
                  - button "k10, empty" [disabled] [ref=e280]
                  - button "l10, empty" [disabled] [ref=e281]
                  - button "m10, empty" [disabled] [ref=e282]
                  - button "n10, empty" [disabled] [ref=e283]
                  - button "o10, empty" [disabled] [ref=e284]
                  - generic [ref=e285]: "11"
                  - button "3W, a11, triple word, empty" [disabled] [ref=e286]:
                    - generic [ref=e287]: 3W
                  - button "b11, empty" [disabled] [ref=e288]
                  - button "3L, c11, triple letter, empty" [disabled] [ref=e289]:
                    - generic [ref=e290]: 3L
                  - button "d11, empty" [disabled] [ref=e291]
                  - button "e11, empty" [disabled] [ref=e292]
                  - button "f11, empty" [disabled] [ref=e293]
                  - button "2L, g11, double letter, empty" [disabled] [ref=e294]:
                    - generic [ref=e295]: 2L
                  - button "h11, empty" [disabled] [ref=e296]
                  - button "2L, i11, double letter, empty" [disabled] [ref=e297]:
                    - generic [ref=e298]: 2L
                  - button "j11, empty" [disabled] [ref=e299]
                  - button "k11, empty" [disabled] [ref=e300]
                  - button "l11, empty" [disabled] [ref=e301]
                  - button "3L, m11, triple letter, empty" [disabled] [ref=e302]:
                    - generic [ref=e303]: 3L
                  - button "n11, empty" [disabled] [ref=e304]
                  - button "3W, o11, triple word, empty" [disabled] [ref=e305]:
                    - generic [ref=e306]: 3W
                  - generic [ref=e307]: "12"
                  - button "a12, empty" [disabled] [ref=e308]
                  - button "2L, b12, double letter, empty" [disabled] [ref=e309]:
                    - generic [ref=e310]: 2L
                  - button "c12, empty" [disabled] [ref=e311]
                  - button "2W, d12, double word, empty" [disabled] [ref=e312]:
                    - generic [ref=e313]: 2W
                  - button "e12, empty" [disabled] [ref=e314]
                  - button "f12, empty" [disabled] [ref=e315]
                  - button "g12, empty" [disabled] [ref=e316]
                  - button "h12, empty" [disabled] [ref=e317]
                  - button "i12, empty" [disabled] [ref=e318]
                  - button "j12, empty" [disabled] [ref=e319]
                  - button "k12, empty" [disabled] [ref=e320]
                  - button "2W, l12, double word, empty" [disabled] [ref=e321]:
                    - generic [ref=e322]: 2W
                  - button "m12, empty" [disabled] [ref=e323]
                  - button "2L, n12, double letter, empty" [disabled] [ref=e324]:
                    - generic [ref=e325]: 2L
                  - button "o12, empty" [disabled] [ref=e326]
                  - generic [ref=e327]: "13"
                  - button "a13, empty" [disabled] [ref=e328]
                  - button "b13, empty" [disabled] [ref=e329]
                  - button "c13, empty" [disabled] [ref=e330]
                  - button "d13, empty" [disabled] [ref=e331]
                  - button "3L, e13, triple letter, empty" [disabled] [ref=e332]:
                    - generic [ref=e333]: 3L
                  - button "f13, empty" [disabled] [ref=e334]
                  - button "g13, empty" [disabled] [ref=e335]
                  - button "h13, empty" [disabled] [ref=e336]
                  - button "i13, empty" [disabled] [ref=e337]
                  - button "j13, empty" [disabled] [ref=e338]
                  - button "3L, k13, triple letter, empty" [disabled] [ref=e339]:
                    - generic [ref=e340]: 3L
                  - button "l13, empty" [disabled] [ref=e341]
                  - button "m13, empty" [disabled] [ref=e342]
                  - button "n13, empty" [disabled] [ref=e343]
                  - button "o13, empty" [disabled] [ref=e344]
                  - generic [ref=e345]: "14"
                  - button "a14, empty" [disabled] [ref=e346]
                  - button "b14, empty" [disabled] [ref=e347]
                  - button "c14, empty" [disabled] [ref=e348]
                  - button "2L, d14, double letter, empty" [disabled] [ref=e349]:
                    - generic [ref=e350]: 2L
                  - button "e14, empty" [disabled] [ref=e351]
                  - button "f14, empty" [disabled] [ref=e352]
                  - button "2W, g14, double word, empty" [disabled] [ref=e353]:
                    - generic [ref=e354]: 2W
                  - button "h14, empty" [disabled] [ref=e355]
                  - button "2W, i14, double word, empty" [disabled] [ref=e356]:
                    - generic [ref=e357]: 2W
                  - button "j14, empty" [disabled] [ref=e358]
                  - button "k14, empty" [disabled] [ref=e359]
                  - button "2L, l14, double letter, empty" [disabled] [ref=e360]:
                    - generic [ref=e361]: 2L
                  - button "m14, empty" [disabled] [ref=e362]
                  - button "n14, empty" [disabled] [ref=e363]
                  - button "o14, empty" [disabled] [ref=e364]
                  - generic [ref=e365]: "15"
                  - button "2L, a15, double letter, empty" [disabled] [ref=e366]:
                    - generic [ref=e367]: 2L
                  - button "b15, empty" [disabled] [ref=e368]
                  - button "c15, empty" [disabled] [ref=e369]
                  - button "d15, empty" [disabled] [ref=e370]
                  - button "3W, e15, triple word, empty" [disabled] [ref=e371]:
                    - generic [ref=e372]: 3W
                  - button "f15, empty" [disabled] [ref=e373]
                  - button "g15, empty" [disabled] [ref=e374]
                  - button "2L, h15, double letter, empty" [disabled] [ref=e375]:
                    - generic [ref=e376]: 2L
                  - button "i15, empty" [disabled] [ref=e377]
                  - button "j15, empty" [disabled] [ref=e378]
                  - button "3W, k15, triple word, empty" [disabled] [ref=e379]:
                    - generic [ref=e380]: 3W
                  - button "l15, empty" [disabled] [ref=e381]
                  - button "m15, empty" [disabled] [ref=e382]
                  - button "n15, empty" [disabled] [ref=e383]
                  - button "2L, o15, double letter, empty" [disabled] [ref=e384]:
                    - generic [ref=e385]: 2L
          - status [ref=e387]:
            - generic [ref=e388]:
              - generic [ref=e389]: "Amber: avery. Teal: jordan_plays."
              - text: Amber — to play · 81 tiles in the bag
          - generic [ref=e392]:
            - generic [ref=e396]:
              - generic [ref=e397]:
                - img "Amber" [ref=e398]
                - generic "avery" [ref=e401]
                - generic [ref=e402]: To move
              - generic [ref=e405]: 7 tiles
            - generic [ref=e406]:
              - generic [ref=e407]: Score
              - generic [ref=e408]: "10"
        - region "Game record" [ref=e411]:
          - generic [ref=e412]:
            - heading "Game record" [level=2] [ref=e414]
            - paragraph [ref=e415]: Amber — to play · 81 tiles in the bag
          - button "History and stats" [ref=e418] [cursor=pointer]:
            - paragraph [ref=e421]: History and stats
      - generic [ref=e422]:
        - img [ref=e425]
        - generic [ref=e428]:
          - paragraph [ref=e429]: You're watching
          - paragraph [ref=e430]: Moves appear as they are played.
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