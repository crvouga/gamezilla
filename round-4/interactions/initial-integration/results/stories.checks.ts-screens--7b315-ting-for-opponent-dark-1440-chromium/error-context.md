# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--waiting-for-opponent dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  117774 pixels (ratio 0.10 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/waiting-for-opponent-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/waiting-for-opponent-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 117774 pixels (ratio 0.10 of all image pixels) are different.
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
  - 117774 pixels (ratio 0.10 of all image pixels) are different.

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
    - generic [ref=e25]:
      - generic [ref=e27]:
        - generic [ref=e29]:
          - generic [ref=e33]:
            - generic [ref=e34]:
              - img "Teal" [ref=e35]
              - generic [ref=e36]: jordan_plays
              - generic [ref=e37]: To move
            - generic [ref=e40]: 7 tiles
          - generic [ref=e41]:
            - generic [ref=e42]: Score
            - generic [ref=e43]: "3"
        - generic [ref=e45]:
          - group "Your rack" [ref=e46]:
            - button "O, 1 points" [ref=e47] [cursor=pointer]:
              - generic [ref=e48]: O
              - generic [ref=e49]: "1"
            - button "E, 1 points" [ref=e50] [cursor=pointer]:
              - generic [ref=e51]: E
              - generic [ref=e52]: "1"
            - button "R, 1 points" [ref=e53] [cursor=pointer]:
              - generic [ref=e54]: R
              - generic [ref=e55]: "1"
            - button "T, 1 points" [ref=e56] [cursor=pointer]:
              - generic [ref=e57]: T
              - generic [ref=e58]: "1"
            - button "I, 1 points" [ref=e59] [cursor=pointer]:
              - generic [ref=e60]: I
              - generic [ref=e61]: "1"
            - button "N, 1 points" [ref=e62] [cursor=pointer]:
              - generic [ref=e63]: "N"
              - generic [ref=e64]: "1"
            - button "Blank, 0 points" [ref=e65] [cursor=pointer]:
              - generic [ref=e66]: "0"
          - generic [ref=e67]:
            - group "Word actions" [ref=e68]:
              - button "Play word" [disabled] [ref=e69]:
                - paragraph [ref=e72]: Play word
              - button "Recall tiles" [disabled] [ref=e73]:
                - paragraph [ref=e76]: Recall tiles
              - button "Undo" [disabled] [ref=e77]:
                - paragraph [ref=e80]: Undo
              - button "Redo" [disabled] [ref=e81]:
                - paragraph [ref=e84]: Redo
              - button "Shuffle rack" [ref=e85] [cursor=pointer]:
                - paragraph [ref=e88]: Shuffle rack
              - button "Pass" [disabled] [ref=e89]:
                - paragraph [ref=e92]: Pass
              - button "Exchange tiles" [disabled] [ref=e93]:
                - paragraph [ref=e96]: Exchange tiles
            - generic [ref=e97]:
              - paragraph [ref=e98]: You can plan a word while you wait. Play it when your turn begins.
              - status [ref=e100]: Choose a tile, then a square.
          - generic [ref=e101]:
            - generic [ref=e102]:
              - button "Fit board" [pressed] [ref=e103] [cursor=pointer]:
                - paragraph [ref=e106]: Fit board
              - button "Enlarge board" [ref=e107] [cursor=pointer]:
                - paragraph [ref=e110]: Enlarge board
            - region "Scrollable word board" [ref=e112]:
              - group "Word board, fifteen columns and fifteen rows" [ref=e113]:
                - generic [ref=e115]: a
                - generic [ref=e116]: b
                - generic [ref=e117]: c
                - generic [ref=e118]: d
                - generic [ref=e119]: e
                - generic [ref=e120]: f
                - generic [ref=e121]: g
                - generic [ref=e122]: h
                - generic [ref=e123]: i
                - generic [ref=e124]: j
                - generic [ref=e125]: k
                - generic [ref=e126]: l
                - generic [ref=e127]: m
                - generic [ref=e128]: "n"
                - generic [ref=e129]: o
                - generic [ref=e130]: "1"
                - button "2L, a1, double letter, empty" [ref=e131] [cursor=pointer]:
                  - generic [ref=e132]: 2L
                - button "b1, empty" [ref=e133] [cursor=pointer]
                - button "c1, empty" [ref=e134] [cursor=pointer]
                - button "d1, empty" [ref=e135] [cursor=pointer]
                - button "3W, e1, triple word, empty" [ref=e136] [cursor=pointer]:
                  - generic [ref=e137]: 3W
                - button "f1, empty" [ref=e138] [cursor=pointer]
                - button "g1, empty" [ref=e139] [cursor=pointer]
                - button "2L, h1, double letter, empty" [ref=e140] [cursor=pointer]:
                  - generic [ref=e141]: 2L
                - button "i1, empty" [ref=e142] [cursor=pointer]
                - button "j1, empty" [ref=e143] [cursor=pointer]
                - button "3W, k1, triple word, empty" [ref=e144] [cursor=pointer]:
                  - generic [ref=e145]: 3W
                - button "l1, empty" [ref=e146] [cursor=pointer]
                - button "m1, empty" [ref=e147] [cursor=pointer]
                - button "n1, empty" [ref=e148] [cursor=pointer]
                - button "2L, o1, double letter, empty" [ref=e149] [cursor=pointer]:
                  - generic [ref=e150]: 2L
                - generic [ref=e151]: "2"
                - button "a2, empty" [ref=e152] [cursor=pointer]
                - button "b2, empty" [ref=e153] [cursor=pointer]
                - button "c2, empty" [ref=e154] [cursor=pointer]
                - button "2L, d2, double letter, empty" [ref=e155] [cursor=pointer]:
                  - generic [ref=e156]: 2L
                - button "e2, empty" [ref=e157] [cursor=pointer]
                - button "f2, empty" [ref=e158] [cursor=pointer]
                - button "2W, g2, double word, empty" [ref=e159] [cursor=pointer]:
                  - generic [ref=e160]: 2W
                - button "h2, empty" [ref=e161] [cursor=pointer]
                - button "2W, i2, double word, empty" [ref=e162] [cursor=pointer]:
                  - generic [ref=e163]: 2W
                - button "j2, empty" [ref=e164] [cursor=pointer]
                - button "k2, empty" [ref=e165] [cursor=pointer]
                - button "2L, l2, double letter, empty" [ref=e166] [cursor=pointer]:
                  - generic [ref=e167]: 2L
                - button "m2, empty" [ref=e168] [cursor=pointer]
                - button "n2, empty" [ref=e169] [cursor=pointer]
                - button "o2, empty" [ref=e170] [cursor=pointer]
                - generic [ref=e171]: "3"
                - button "a3, empty" [ref=e172] [cursor=pointer]
                - button "b3, empty" [ref=e173] [cursor=pointer]
                - button "c3, empty" [ref=e174] [cursor=pointer]
                - button "d3, empty" [ref=e175] [cursor=pointer]
                - button "3L, e3, triple letter, empty" [ref=e176] [cursor=pointer]:
                  - generic [ref=e177]: 3L
                - button "f3, empty" [ref=e178] [cursor=pointer]
                - button "g3, empty" [ref=e179] [cursor=pointer]
                - button "h3, empty" [ref=e180] [cursor=pointer]
                - button "i3, empty" [ref=e181] [cursor=pointer]
                - button "j3, empty" [ref=e182] [cursor=pointer]
                - button "3L, k3, triple letter, empty" [ref=e183] [cursor=pointer]:
                  - generic [ref=e184]: 3L
                - button "l3, empty" [ref=e185] [cursor=pointer]
                - button "m3, empty" [ref=e186] [cursor=pointer]
                - button "n3, empty" [ref=e187] [cursor=pointer]
                - button "o3, empty" [ref=e188] [cursor=pointer]
                - generic [ref=e189]: "4"
                - button "a4, empty" [ref=e190] [cursor=pointer]
                - button "2L, b4, double letter, empty" [ref=e191] [cursor=pointer]:
                  - generic [ref=e192]: 2L
                - button "c4, empty" [ref=e193] [cursor=pointer]
                - button "2W, d4, double word, empty" [ref=e194] [cursor=pointer]:
                  - generic [ref=e195]: 2W
                - button "e4, empty" [ref=e196] [cursor=pointer]
                - button "f4, empty" [ref=e197] [cursor=pointer]
                - button "g4, empty" [ref=e198] [cursor=pointer]
                - button "h4, empty" [ref=e199] [cursor=pointer]
                - button "i4, empty" [ref=e200] [cursor=pointer]
                - button "j4, empty" [ref=e201] [cursor=pointer]
                - button "k4, empty" [ref=e202] [cursor=pointer]
                - button "2W, l4, double word, empty" [ref=e203] [cursor=pointer]:
                  - generic [ref=e204]: 2W
                - button "m4, empty" [ref=e205] [cursor=pointer]
                - button "2L, n4, double letter, empty" [ref=e206] [cursor=pointer]:
                  - generic [ref=e207]: 2L
                - button "o4, empty" [ref=e208] [cursor=pointer]
                - generic [ref=e209]: "5"
                - button "3W, a5, triple word, empty" [ref=e210] [cursor=pointer]:
                  - generic [ref=e211]: 3W
                - button "b5, empty" [ref=e212] [cursor=pointer]
                - button "3L, c5, triple letter, empty" [ref=e213] [cursor=pointer]:
                  - generic [ref=e214]: 3L
                - button "d5, empty" [ref=e215] [cursor=pointer]
                - button "e5, empty" [ref=e216] [cursor=pointer]
                - button "f5, empty" [ref=e217] [cursor=pointer]
                - button "2L, g5, double letter, empty" [ref=e218] [cursor=pointer]:
                  - generic [ref=e219]: 2L
                - button "h5, empty" [ref=e220] [cursor=pointer]
                - button "2L, i5, double letter, empty" [ref=e221] [cursor=pointer]:
                  - generic [ref=e222]: 2L
                - button "j5, empty" [ref=e223] [cursor=pointer]
                - button "k5, empty" [ref=e224] [cursor=pointer]
                - button "l5, empty" [ref=e225] [cursor=pointer]
                - button "3L, m5, triple letter, empty" [ref=e226] [cursor=pointer]:
                  - generic [ref=e227]: 3L
                - button "n5, empty" [ref=e228] [cursor=pointer]
                - button "3W, o5, triple word, empty" [ref=e229] [cursor=pointer]:
                  - generic [ref=e230]: 3W
                - generic [ref=e231]: "6"
                - button "a6, empty" [ref=e232] [cursor=pointer]
                - button "b6, empty" [ref=e233] [cursor=pointer]
                - button "c6, empty" [ref=e234] [cursor=pointer]
                - button "d6, empty" [ref=e235] [cursor=pointer]
                - button "e6, empty" [ref=e236] [cursor=pointer]
                - button "f6, empty" [ref=e237] [cursor=pointer]
                - button "g6, empty" [ref=e238] [cursor=pointer]
                - button "3L, h6, triple letter, empty" [ref=e239] [cursor=pointer]:
                  - generic [ref=e240]: 3L
                - button "i6, empty" [ref=e241] [cursor=pointer]
                - button "j6, empty" [ref=e242] [cursor=pointer]
                - button "k6, empty" [ref=e243] [cursor=pointer]
                - button "l6, empty" [ref=e244] [cursor=pointer]
                - button "m6, empty" [ref=e245] [cursor=pointer]
                - button "n6, empty" [ref=e246] [cursor=pointer]
                - button "o6, empty" [ref=e247] [cursor=pointer]
                - generic [ref=e248]: "7"
                - button "a7, empty" [ref=e249] [cursor=pointer]
                - button "2W, b7, double word, empty" [ref=e250] [cursor=pointer]:
                  - generic [ref=e251]: 2W
                - button "c7, empty" [ref=e252] [cursor=pointer]
                - button "d7, empty" [ref=e253] [cursor=pointer]
                - button "2L, e7, double letter, empty" [ref=e254] [cursor=pointer]:
                  - generic [ref=e255]: 2L
                - button "f7, empty" [ref=e256] [cursor=pointer]
                - button "2L, g7, double letter, empty" [ref=e257] [cursor=pointer]:
                  - generic [ref=e258]: 2L
                - button "h7, empty" [ref=e259] [cursor=pointer]
                - button "2L, i7, double letter, empty" [ref=e260] [cursor=pointer]:
                  - generic [ref=e261]: 2L
                - button "j7, empty" [ref=e262] [cursor=pointer]
                - button "2L, k7, double letter, empty" [ref=e263] [cursor=pointer]:
                  - generic [ref=e264]: 2L
                - button "l7, empty" [ref=e265] [cursor=pointer]
                - button "m7, empty" [ref=e266] [cursor=pointer]
                - button "2W, n7, double word, empty" [ref=e267] [cursor=pointer]:
                  - generic [ref=e268]: 2W
                - button "o7, empty" [ref=e269] [cursor=pointer]
                - generic [ref=e270]: "8"
                - button "2L, a8, double letter, empty" [ref=e271] [cursor=pointer]:
                  - generic [ref=e272]: 2L
                - button "b8, empty" [ref=e273] [cursor=pointer]
                - button "c8, empty" [ref=e274] [cursor=pointer]
                - button "d8, empty" [ref=e275] [cursor=pointer]
                - button "e8, empty" [ref=e276] [cursor=pointer]
                - button "3L, f8, triple letter, empty" [ref=e277] [cursor=pointer]:
                  - generic [ref=e278]: 3L
                - button "C 3, g8, committed" [disabled] [ref=e279]:
                  - generic [ref=e280]: C
                  - generic [ref=e281]: "3"
                - button "A 1, h8, committed" [disabled] [ref=e282]:
                  - generic [ref=e283]: A
                  - generic [ref=e284]: "1"
                - button "T 1, i8, committed" [disabled] [ref=e285]:
                  - generic [ref=e286]: T
                  - generic [ref=e287]: "1"
                - button "3L, j8, triple letter, empty" [ref=e288] [cursor=pointer]:
                  - generic [ref=e289]: 3L
                - button "k8, empty" [ref=e290] [cursor=pointer]
                - button "l8, empty" [ref=e291] [cursor=pointer]
                - button "m8, empty" [ref=e292] [cursor=pointer]
                - button "n8, empty" [ref=e293] [cursor=pointer]
                - button "2L, o8, double letter, empty" [ref=e294] [cursor=pointer]:
                  - generic [ref=e295]: 2L
                - generic [ref=e296]: "9"
                - button "a9, empty" [ref=e297] [cursor=pointer]
                - button "2W, b9, double word, empty" [ref=e298] [cursor=pointer]:
                  - generic [ref=e299]: 2W
                - button "c9, empty" [ref=e300] [cursor=pointer]
                - button "d9, empty" [ref=e301] [cursor=pointer]
                - button "2L, e9, double letter, empty" [ref=e302] [cursor=pointer]:
                  - generic [ref=e303]: 2L
                - button "f9, empty" [ref=e304] [cursor=pointer]
                - button "2L, g9, double letter, empty" [ref=e305] [cursor=pointer]:
                  - generic [ref=e306]: 2L
                - button "h9, empty" [ref=e307] [cursor=pointer]
                - button "O 1, i9, committed" [disabled] [ref=e308]:
                  - generic [ref=e309]: O
                  - generic [ref=e310]: "1"
                - button "j9, empty" [ref=e311] [cursor=pointer]
                - button "2L, k9, double letter, empty" [ref=e312] [cursor=pointer]:
                  - generic [ref=e313]: 2L
                - button "l9, empty" [ref=e314] [cursor=pointer]
                - button "m9, empty" [ref=e315] [cursor=pointer]
                - button "2W, n9, double word, empty" [ref=e316] [cursor=pointer]:
                  - generic [ref=e317]: 2W
                - button "o9, empty" [ref=e318] [cursor=pointer]
                - generic [ref=e319]: "10"
                - button "a10, empty" [ref=e320] [cursor=pointer]
                - button "b10, empty" [ref=e321] [cursor=pointer]
                - button "c10, empty" [ref=e322] [cursor=pointer]
                - button "d10, empty" [ref=e323] [cursor=pointer]
                - button "e10, empty" [ref=e324] [cursor=pointer]
                - button "f10, empty" [ref=e325] [cursor=pointer]
                - button "g10, empty" [ref=e326] [cursor=pointer]
                - button "3L, h10, triple letter, empty" [ref=e327] [cursor=pointer]:
                  - generic [ref=e328]: 3L
                - button "E 1, i10, committed" [disabled] [ref=e329]:
                  - generic [ref=e330]: E
                  - generic [ref=e331]: "1"
                - button "j10, empty" [ref=e332] [cursor=pointer]
                - button "k10, empty" [ref=e333] [cursor=pointer]
                - button "l10, empty" [ref=e334] [cursor=pointer]
                - button "m10, empty" [ref=e335] [cursor=pointer]
                - button "n10, empty" [ref=e336] [cursor=pointer]
                - button "o10, empty" [ref=e337] [cursor=pointer]
                - generic [ref=e338]: "11"
                - button "3W, a11, triple word, empty" [ref=e339] [cursor=pointer]:
                  - generic [ref=e340]: 3W
                - button "b11, empty" [ref=e341] [cursor=pointer]
                - button "3L, c11, triple letter, empty" [ref=e342] [cursor=pointer]:
                  - generic [ref=e343]: 3L
                - button "d11, empty" [ref=e344] [cursor=pointer]
                - button "e11, empty" [ref=e345] [cursor=pointer]
                - button "f11, empty" [ref=e346] [cursor=pointer]
                - button "2L, g11, double letter, empty" [ref=e347] [cursor=pointer]:
                  - generic [ref=e348]: 2L
                - button "h11, empty" [ref=e349] [cursor=pointer]
                - button "2L, i11, double letter, empty" [ref=e350] [cursor=pointer]:
                  - generic [ref=e351]: 2L
                - button "j11, empty" [ref=e352] [cursor=pointer]
                - button "k11, empty" [ref=e353] [cursor=pointer]
                - button "l11, empty" [ref=e354] [cursor=pointer]
                - button "3L, m11, triple letter, empty" [ref=e355] [cursor=pointer]:
                  - generic [ref=e356]: 3L
                - button "n11, empty" [ref=e357] [cursor=pointer]
                - button "3W, o11, triple word, empty" [ref=e358] [cursor=pointer]:
                  - generic [ref=e359]: 3W
                - generic [ref=e360]: "12"
                - button "a12, empty" [ref=e361] [cursor=pointer]
                - button "2L, b12, double letter, empty" [ref=e362] [cursor=pointer]:
                  - generic [ref=e363]: 2L
                - button "c12, empty" [ref=e364] [cursor=pointer]
                - button "2W, d12, double word, empty" [ref=e365] [cursor=pointer]:
                  - generic [ref=e366]: 2W
                - button "e12, empty" [ref=e367] [cursor=pointer]
                - button "f12, empty" [ref=e368] [cursor=pointer]
                - button "g12, empty" [ref=e369] [cursor=pointer]
                - button "h12, empty" [ref=e370] [cursor=pointer]
                - button "i12, empty" [ref=e371] [cursor=pointer]
                - button "j12, empty" [ref=e372] [cursor=pointer]
                - button "k12, empty" [ref=e373] [cursor=pointer]
                - button "2W, l12, double word, empty" [ref=e374] [cursor=pointer]:
                  - generic [ref=e375]: 2W
                - button "m12, empty" [ref=e376] [cursor=pointer]
                - button "2L, n12, double letter, empty" [ref=e377] [cursor=pointer]:
                  - generic [ref=e378]: 2L
                - button "o12, empty" [ref=e379] [cursor=pointer]
                - generic [ref=e380]: "13"
                - button "a13, empty" [ref=e381] [cursor=pointer]
                - button "b13, empty" [ref=e382] [cursor=pointer]
                - button "c13, empty" [ref=e383] [cursor=pointer]
                - button "d13, empty" [ref=e384] [cursor=pointer]
                - button "3L, e13, triple letter, empty" [ref=e385] [cursor=pointer]:
                  - generic [ref=e386]: 3L
                - button "f13, empty" [ref=e387] [cursor=pointer]
                - button "g13, empty" [ref=e388] [cursor=pointer]
                - button "h13, empty" [ref=e389] [cursor=pointer]
                - button "i13, empty" [ref=e390] [cursor=pointer]
                - button "j13, empty" [ref=e391] [cursor=pointer]
                - button "3L, k13, triple letter, empty" [ref=e392] [cursor=pointer]:
                  - generic [ref=e393]: 3L
                - button "l13, empty" [ref=e394] [cursor=pointer]
                - button "m13, empty" [ref=e395] [cursor=pointer]
                - button "n13, empty" [ref=e396] [cursor=pointer]
                - button "o13, empty" [ref=e397] [cursor=pointer]
                - generic [ref=e398]: "14"
                - button "a14, empty" [ref=e399] [cursor=pointer]
                - button "b14, empty" [ref=e400] [cursor=pointer]
                - button "c14, empty" [ref=e401] [cursor=pointer]
                - button "2L, d14, double letter, empty" [ref=e402] [cursor=pointer]:
                  - generic [ref=e403]: 2L
                - button "e14, empty" [ref=e404] [cursor=pointer]
                - button "f14, empty" [ref=e405] [cursor=pointer]
                - button "2W, g14, double word, empty" [ref=e406] [cursor=pointer]:
                  - generic [ref=e407]: 2W
                - button "h14, empty" [ref=e408] [cursor=pointer]
                - button "2W, i14, double word, empty" [ref=e409] [cursor=pointer]:
                  - generic [ref=e410]: 2W
                - button "j14, empty" [ref=e411] [cursor=pointer]
                - button "k14, empty" [ref=e412] [cursor=pointer]
                - button "2L, l14, double letter, empty" [ref=e413] [cursor=pointer]:
                  - generic [ref=e414]: 2L
                - button "m14, empty" [ref=e415] [cursor=pointer]
                - button "n14, empty" [ref=e416] [cursor=pointer]
                - button "o14, empty" [ref=e417] [cursor=pointer]
                - generic [ref=e418]: "15"
                - button "2L, a15, double letter, empty" [ref=e419] [cursor=pointer]:
                  - generic [ref=e420]: 2L
                - button "b15, empty" [ref=e421] [cursor=pointer]
                - button "c15, empty" [ref=e422] [cursor=pointer]
                - button "d15, empty" [ref=e423] [cursor=pointer]
                - button "3W, e15, triple word, empty" [ref=e424] [cursor=pointer]:
                  - generic [ref=e425]: 3W
                - button "f15, empty" [ref=e426] [cursor=pointer]
                - button "g15, empty" [ref=e427] [cursor=pointer]
                - button "2L, h15, double letter, empty" [ref=e428] [cursor=pointer]:
                  - generic [ref=e429]: 2L
                - button "i15, empty" [ref=e430] [cursor=pointer]
                - button "j15, empty" [ref=e431] [cursor=pointer]
                - button "3W, k15, triple word, empty" [ref=e432] [cursor=pointer]:
                  - generic [ref=e433]: 3W
                - button "l15, empty" [ref=e434] [cursor=pointer]
                - button "m15, empty" [ref=e435] [cursor=pointer]
                - button "n15, empty" [ref=e436] [cursor=pointer]
                - button "2L, o15, double letter, empty" [ref=e437] [cursor=pointer]:
                  - generic [ref=e438]: 2L
        - status [ref=e440]:
          - generic [ref=e441]:
            - generic [ref=e442]: "Amber: avery. Teal: jordan_plays."
            - text: Teal — to play · 86 tiles in the bag
        - generic [ref=e445]:
          - generic [ref=e449]:
            - generic [ref=e450]:
              - img "Amber" [ref=e451]
              - generic [ref=e452]: avery
            - generic [ref=e455]: 7 tiles
          - generic [ref=e456]:
            - generic [ref=e457]: Score
            - generic [ref=e458]: "10"
      - region "Game record" [ref=e461]:
        - generic [ref=e462]:
          - heading "Game record" [level=2] [ref=e464]
          - paragraph [ref=e465]: Teal — to play · 86 tiles in the bag
        - generic [ref=e467]:
          - group "Game actions" [ref=e468]:
            - button "Offer draw" [ref=e469] [cursor=pointer]:
              - paragraph [ref=e472]: Offer draw
            - button "Resign game" [ref=e473] [cursor=pointer]:
              - paragraph [ref=e476]:
                - text: Resign
                - generic [ref=e477]: game
          - button "History and stats" [ref=e478] [cursor=pointer]:
            - paragraph [ref=e481]: History and stats
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