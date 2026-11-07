# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-word-tiles-board--waiting-for-opponent dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  72100 pixels (ratio 0.22 of all image pixels) are different.

  Snapshot: libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/waiting-for-opponent-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/word-tiles-client-ts/src/baselines/chromium/screens-games-word-tiles-board/waiting-for-opponent-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 72100 pixels (ratio 0.22 of all image pixels) are different.
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
  - 72100 pixels (ratio 0.22 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Word Tiles" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: Teal — to play · 86 tiles in the bag
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - generic [ref=e45]:
              - generic [ref=e46]:
                - img "Teal" [ref=e47]
                - generic "jordan_plays" [ref=e50]
                - generic [ref=e51]: To move
              - generic [ref=e54]: 7 tiles
            - generic [ref=e55]:
              - generic [ref=e56]: Score
              - generic [ref=e57]: "3"
          - generic [ref=e59]:
            - group "Your rack" [ref=e60]:
              - button "O, 1 points" [ref=e61] [cursor=pointer]:
                - generic [ref=e62]: O
                - generic [ref=e63]: "1"
              - button "E, 1 points" [ref=e64] [cursor=pointer]:
                - generic [ref=e65]: E
                - generic [ref=e66]: "1"
              - button "R, 1 points" [ref=e67] [cursor=pointer]:
                - generic [ref=e68]: R
                - generic [ref=e69]: "1"
              - button "T, 1 points" [ref=e70] [cursor=pointer]:
                - generic [ref=e71]: T
                - generic [ref=e72]: "1"
              - button "I, 1 points" [ref=e73] [cursor=pointer]:
                - generic [ref=e74]: I
                - generic [ref=e75]: "1"
              - button "N, 1 points" [ref=e76] [cursor=pointer]:
                - generic [ref=e77]: "N"
                - generic [ref=e78]: "1"
              - button "Blank, 0 points" [ref=e79] [cursor=pointer]:
                - generic [ref=e80]: "0"
            - generic [ref=e81]:
              - group "Word actions" [ref=e83]:
                - button "Play word" [disabled] [ref=e84]:
                  - paragraph [ref=e87]: Play word
                - button "Pass, exchange & tools" [ref=e88] [cursor=pointer]:
                  - paragraph [ref=e91]: Pass, exchange & tools
              - generic [ref=e92]:
                - paragraph [ref=e93]: You can plan a word while you wait. Play it when your turn begins.
                - status [ref=e95]: Choose a tile, then a square.
            - generic [ref=e97]:
              - region "Scrollable word board" [ref=e98]:
                - group "Word board, fifteen columns and fifteen rows" [ref=e99]:
                  - generic [ref=e101]: a
                  - generic [ref=e102]: b
                  - generic [ref=e103]: c
                  - generic [ref=e104]: d
                  - generic [ref=e105]: e
                  - generic [ref=e106]: f
                  - generic [ref=e107]: g
                  - generic [ref=e108]: h
                  - generic [ref=e109]: i
                  - generic [ref=e110]: j
                  - generic [ref=e111]: k
                  - generic [ref=e112]: l
                  - generic [ref=e113]: m
                  - generic [ref=e114]: "n"
                  - generic [ref=e115]: o
                  - generic [ref=e116]: "1"
                  - button "2L, a1, double letter, empty" [ref=e117] [cursor=pointer]:
                    - generic [ref=e118]: 2L
                  - button "b1, empty" [ref=e119] [cursor=pointer]
                  - button "c1, empty" [ref=e120] [cursor=pointer]
                  - button "d1, empty" [ref=e121] [cursor=pointer]
                  - button "3W, e1, triple word, empty" [ref=e122] [cursor=pointer]:
                    - generic [ref=e123]: 3W
                  - button "f1, empty" [ref=e124] [cursor=pointer]
                  - button "g1, empty" [ref=e125] [cursor=pointer]
                  - button "2L, h1, double letter, empty" [ref=e126] [cursor=pointer]:
                    - generic [ref=e127]: 2L
                  - button "i1, empty" [ref=e128] [cursor=pointer]
                  - button "j1, empty" [ref=e129] [cursor=pointer]
                  - button "3W, k1, triple word, empty" [ref=e130] [cursor=pointer]:
                    - generic [ref=e131]: 3W
                  - button "l1, empty" [ref=e132] [cursor=pointer]
                  - button "m1, empty" [ref=e133] [cursor=pointer]
                  - button "n1, empty" [ref=e134] [cursor=pointer]
                  - button "2L, o1, double letter, empty" [ref=e135] [cursor=pointer]:
                    - generic [ref=e136]: 2L
                  - generic [ref=e137]: "2"
                  - button "a2, empty" [ref=e138] [cursor=pointer]
                  - button "b2, empty" [ref=e139] [cursor=pointer]
                  - button "c2, empty" [ref=e140] [cursor=pointer]
                  - button "2L, d2, double letter, empty" [ref=e141] [cursor=pointer]:
                    - generic [ref=e142]: 2L
                  - button "e2, empty" [ref=e143] [cursor=pointer]
                  - button "f2, empty" [ref=e144] [cursor=pointer]
                  - button "2W, g2, double word, empty" [ref=e145] [cursor=pointer]:
                    - generic [ref=e146]: 2W
                  - button "h2, empty" [ref=e147] [cursor=pointer]
                  - button "2W, i2, double word, empty" [ref=e148] [cursor=pointer]:
                    - generic [ref=e149]: 2W
                  - button "j2, empty" [ref=e150] [cursor=pointer]
                  - button "k2, empty" [ref=e151] [cursor=pointer]
                  - button "2L, l2, double letter, empty" [ref=e152] [cursor=pointer]:
                    - generic [ref=e153]: 2L
                  - button "m2, empty" [ref=e154] [cursor=pointer]
                  - button "n2, empty" [ref=e155] [cursor=pointer]
                  - button "o2, empty" [ref=e156] [cursor=pointer]
                  - generic [ref=e157]: "3"
                  - button "a3, empty" [ref=e158] [cursor=pointer]
                  - button "b3, empty" [ref=e159] [cursor=pointer]
                  - button "c3, empty" [ref=e160] [cursor=pointer]
                  - button "d3, empty" [ref=e161] [cursor=pointer]
                  - button "3L, e3, triple letter, empty" [ref=e162] [cursor=pointer]:
                    - generic [ref=e163]: 3L
                  - button "f3, empty" [ref=e164] [cursor=pointer]
                  - button "g3, empty" [ref=e165] [cursor=pointer]
                  - button "h3, empty" [ref=e166] [cursor=pointer]
                  - button "i3, empty" [ref=e167] [cursor=pointer]
                  - button "j3, empty" [ref=e168] [cursor=pointer]
                  - button "3L, k3, triple letter, empty" [ref=e169] [cursor=pointer]:
                    - generic [ref=e170]: 3L
                  - button "l3, empty" [ref=e171] [cursor=pointer]
                  - button "m3, empty" [ref=e172] [cursor=pointer]
                  - button "n3, empty" [ref=e173] [cursor=pointer]
                  - button "o3, empty" [ref=e174] [cursor=pointer]
                  - generic [ref=e175]: "4"
                  - button "a4, empty" [ref=e176] [cursor=pointer]
                  - button "2L, b4, double letter, empty" [ref=e177] [cursor=pointer]:
                    - generic [ref=e178]: 2L
                  - button "c4, empty" [ref=e179] [cursor=pointer]
                  - button "2W, d4, double word, empty" [ref=e180] [cursor=pointer]:
                    - generic [ref=e181]: 2W
                  - button "e4, empty" [ref=e182] [cursor=pointer]
                  - button "f4, empty" [ref=e183] [cursor=pointer]
                  - button "g4, empty" [ref=e184] [cursor=pointer]
                  - button "h4, empty" [ref=e185] [cursor=pointer]
                  - button "i4, empty" [ref=e186] [cursor=pointer]
                  - button "j4, empty" [ref=e187] [cursor=pointer]
                  - button "k4, empty" [ref=e188] [cursor=pointer]
                  - button "2W, l4, double word, empty" [ref=e189] [cursor=pointer]:
                    - generic [ref=e190]: 2W
                  - button "m4, empty" [ref=e191] [cursor=pointer]
                  - button "2L, n4, double letter, empty" [ref=e192] [cursor=pointer]:
                    - generic [ref=e193]: 2L
                  - button "o4, empty" [ref=e194] [cursor=pointer]
                  - generic [ref=e195]: "5"
                  - button "3W, a5, triple word, empty" [ref=e196] [cursor=pointer]:
                    - generic [ref=e197]: 3W
                  - button "b5, empty" [ref=e198] [cursor=pointer]
                  - button "3L, c5, triple letter, empty" [ref=e199] [cursor=pointer]:
                    - generic [ref=e200]: 3L
                  - button "d5, empty" [ref=e201] [cursor=pointer]
                  - button "e5, empty" [ref=e202] [cursor=pointer]
                  - button "f5, empty" [ref=e203] [cursor=pointer]
                  - button "2L, g5, double letter, empty" [ref=e204] [cursor=pointer]:
                    - generic [ref=e205]: 2L
                  - button "h5, empty" [ref=e206] [cursor=pointer]
                  - button "2L, i5, double letter, empty" [ref=e207] [cursor=pointer]:
                    - generic [ref=e208]: 2L
                  - button "j5, empty" [ref=e209] [cursor=pointer]
                  - button "k5, empty" [ref=e210] [cursor=pointer]
                  - button "l5, empty" [ref=e211] [cursor=pointer]
                  - button "3L, m5, triple letter, empty" [ref=e212] [cursor=pointer]:
                    - generic [ref=e213]: 3L
                  - button "n5, empty" [ref=e214] [cursor=pointer]
                  - button "3W, o5, triple word, empty" [ref=e215] [cursor=pointer]:
                    - generic [ref=e216]: 3W
                  - generic [ref=e217]: "6"
                  - button "a6, empty" [ref=e218] [cursor=pointer]
                  - button "b6, empty" [ref=e219] [cursor=pointer]
                  - button "c6, empty" [ref=e220] [cursor=pointer]
                  - button "d6, empty" [ref=e221] [cursor=pointer]
                  - button "e6, empty" [ref=e222] [cursor=pointer]
                  - button "f6, empty" [ref=e223] [cursor=pointer]
                  - button "g6, empty" [ref=e224] [cursor=pointer]
                  - button "3L, h6, triple letter, empty" [ref=e225] [cursor=pointer]:
                    - generic [ref=e226]: 3L
                  - button "i6, empty" [ref=e227] [cursor=pointer]
                  - button "j6, empty" [ref=e228] [cursor=pointer]
                  - button "k6, empty" [ref=e229] [cursor=pointer]
                  - button "l6, empty" [ref=e230] [cursor=pointer]
                  - button "m6, empty" [ref=e231] [cursor=pointer]
                  - button "n6, empty" [ref=e232] [cursor=pointer]
                  - button "o6, empty" [ref=e233] [cursor=pointer]
                  - generic [ref=e234]: "7"
                  - button "a7, empty" [ref=e235] [cursor=pointer]
                  - button "2W, b7, double word, empty" [ref=e236] [cursor=pointer]:
                    - generic [ref=e237]: 2W
                  - button "c7, empty" [ref=e238] [cursor=pointer]
                  - button "d7, empty" [ref=e239] [cursor=pointer]
                  - button "2L, e7, double letter, empty" [ref=e240] [cursor=pointer]:
                    - generic [ref=e241]: 2L
                  - button "f7, empty" [ref=e242] [cursor=pointer]
                  - button "2L, g7, double letter, empty" [ref=e243] [cursor=pointer]:
                    - generic [ref=e244]: 2L
                  - button "h7, empty" [ref=e245] [cursor=pointer]
                  - button "2L, i7, double letter, empty" [ref=e246] [cursor=pointer]:
                    - generic [ref=e247]: 2L
                  - button "j7, empty" [ref=e248] [cursor=pointer]
                  - button "2L, k7, double letter, empty" [ref=e249] [cursor=pointer]:
                    - generic [ref=e250]: 2L
                  - button "l7, empty" [ref=e251] [cursor=pointer]
                  - button "m7, empty" [ref=e252] [cursor=pointer]
                  - button "2W, n7, double word, empty" [ref=e253] [cursor=pointer]:
                    - generic [ref=e254]: 2W
                  - button "o7, empty" [ref=e255] [cursor=pointer]
                  - generic [ref=e256]: "8"
                  - button "2L, a8, double letter, empty" [ref=e257] [cursor=pointer]:
                    - generic [ref=e258]: 2L
                  - button "b8, empty" [ref=e259] [cursor=pointer]
                  - button "c8, empty" [ref=e260] [cursor=pointer]
                  - button "d8, empty" [ref=e261] [cursor=pointer]
                  - button "e8, empty" [ref=e262] [cursor=pointer]
                  - button "3L, f8, triple letter, empty" [ref=e263] [cursor=pointer]:
                    - generic [ref=e264]: 3L
                  - button "C 3, g8, committed" [disabled] [ref=e265]:
                    - generic [ref=e266]: C
                    - generic [ref=e267]: "3"
                  - button "A 1, h8, committed" [disabled] [ref=e268]:
                    - generic [ref=e269]: A
                    - generic [ref=e270]: "1"
                  - button "T 1, i8, committed" [disabled] [ref=e271]:
                    - generic [ref=e272]: T
                    - generic [ref=e273]: "1"
                  - button "3L, j8, triple letter, empty" [ref=e274] [cursor=pointer]:
                    - generic [ref=e275]: 3L
                  - button "k8, empty" [ref=e276] [cursor=pointer]
                  - button "l8, empty" [ref=e277] [cursor=pointer]
                  - button "m8, empty" [ref=e278] [cursor=pointer]
                  - button "n8, empty" [ref=e279] [cursor=pointer]
                  - button "2L, o8, double letter, empty" [ref=e280] [cursor=pointer]:
                    - generic [ref=e281]: 2L
                  - generic [ref=e282]: "9"
                  - button "a9, empty" [ref=e283] [cursor=pointer]
                  - button "2W, b9, double word, empty" [ref=e284] [cursor=pointer]:
                    - generic [ref=e285]: 2W
                  - button "c9, empty" [ref=e286] [cursor=pointer]
                  - button "d9, empty" [ref=e287] [cursor=pointer]
                  - button "2L, e9, double letter, empty" [ref=e288] [cursor=pointer]:
                    - generic [ref=e289]: 2L
                  - button "f9, empty" [ref=e290] [cursor=pointer]
                  - button "2L, g9, double letter, empty" [ref=e291] [cursor=pointer]:
                    - generic [ref=e292]: 2L
                  - button "h9, empty" [ref=e293] [cursor=pointer]
                  - button "O 1, i9, committed" [disabled] [ref=e294]:
                    - generic [ref=e295]: O
                    - generic [ref=e296]: "1"
                  - button "j9, empty" [ref=e297] [cursor=pointer]
                  - button "2L, k9, double letter, empty" [ref=e298] [cursor=pointer]:
                    - generic [ref=e299]: 2L
                  - button "l9, empty" [ref=e300] [cursor=pointer]
                  - button "m9, empty" [ref=e301] [cursor=pointer]
                  - button "2W, n9, double word, empty" [ref=e302] [cursor=pointer]:
                    - generic [ref=e303]: 2W
                  - button "o9, empty" [ref=e304] [cursor=pointer]
                  - generic [ref=e305]: "10"
                  - button "a10, empty" [ref=e306] [cursor=pointer]
                  - button "b10, empty" [ref=e307] [cursor=pointer]
                  - button "c10, empty" [ref=e308] [cursor=pointer]
                  - button "d10, empty" [ref=e309] [cursor=pointer]
                  - button "e10, empty" [ref=e310] [cursor=pointer]
                  - button "f10, empty" [ref=e311] [cursor=pointer]
                  - button "g10, empty" [ref=e312] [cursor=pointer]
                  - button "3L, h10, triple letter, empty" [ref=e313] [cursor=pointer]:
                    - generic [ref=e314]: 3L
                  - button "E 1, i10, committed" [disabled] [ref=e315]:
                    - generic [ref=e316]: E
                    - generic [ref=e317]: "1"
                  - button "j10, empty" [ref=e318] [cursor=pointer]
                  - button "k10, empty" [ref=e319] [cursor=pointer]
                  - button "l10, empty" [ref=e320] [cursor=pointer]
                  - button "m10, empty" [ref=e321] [cursor=pointer]
                  - button "n10, empty" [ref=e322] [cursor=pointer]
                  - button "o10, empty" [ref=e323] [cursor=pointer]
                  - generic [ref=e324]: "11"
                  - button "3W, a11, triple word, empty" [ref=e325] [cursor=pointer]:
                    - generic [ref=e326]: 3W
                  - button "b11, empty" [ref=e327] [cursor=pointer]
                  - button "3L, c11, triple letter, empty" [ref=e328] [cursor=pointer]:
                    - generic [ref=e329]: 3L
                  - button "d11, empty" [ref=e330] [cursor=pointer]
                  - button "e11, empty" [ref=e331] [cursor=pointer]
                  - button "f11, empty" [ref=e332] [cursor=pointer]
                  - button "2L, g11, double letter, empty" [ref=e333] [cursor=pointer]:
                    - generic [ref=e334]: 2L
                  - button "h11, empty" [ref=e335] [cursor=pointer]
                  - button "2L, i11, double letter, empty" [ref=e336] [cursor=pointer]:
                    - generic [ref=e337]: 2L
                  - button "j11, empty" [ref=e338] [cursor=pointer]
                  - button "k11, empty" [ref=e339] [cursor=pointer]
                  - button "l11, empty" [ref=e340] [cursor=pointer]
                  - button "3L, m11, triple letter, empty" [ref=e341] [cursor=pointer]:
                    - generic [ref=e342]: 3L
                  - button "n11, empty" [ref=e343] [cursor=pointer]
                  - button "3W, o11, triple word, empty" [ref=e344] [cursor=pointer]:
                    - generic [ref=e345]: 3W
                  - generic [ref=e346]: "12"
                  - button "a12, empty" [ref=e347] [cursor=pointer]
                  - button "2L, b12, double letter, empty" [ref=e348] [cursor=pointer]:
                    - generic [ref=e349]: 2L
                  - button "c12, empty" [ref=e350] [cursor=pointer]
                  - button "2W, d12, double word, empty" [ref=e351] [cursor=pointer]:
                    - generic [ref=e352]: 2W
                  - button "e12, empty" [ref=e353] [cursor=pointer]
                  - button "f12, empty" [ref=e354] [cursor=pointer]
                  - button "g12, empty" [ref=e355] [cursor=pointer]
                  - button "h12, empty" [ref=e356] [cursor=pointer]
                  - button "i12, empty" [ref=e357] [cursor=pointer]
                  - button "j12, empty" [ref=e358] [cursor=pointer]
                  - button "k12, empty" [ref=e359] [cursor=pointer]
                  - button "2W, l12, double word, empty" [ref=e360] [cursor=pointer]:
                    - generic [ref=e361]: 2W
                  - button "m12, empty" [ref=e362] [cursor=pointer]
                  - button "2L, n12, double letter, empty" [ref=e363] [cursor=pointer]:
                    - generic [ref=e364]: 2L
                  - button "o12, empty" [ref=e365] [cursor=pointer]
                  - generic [ref=e366]: "13"
                  - button "a13, empty" [ref=e367] [cursor=pointer]
                  - button "b13, empty" [ref=e368] [cursor=pointer]
                  - button "c13, empty" [ref=e369] [cursor=pointer]
                  - button "d13, empty" [ref=e370] [cursor=pointer]
                  - button "3L, e13, triple letter, empty" [ref=e371] [cursor=pointer]:
                    - generic [ref=e372]: 3L
                  - button "f13, empty" [ref=e373] [cursor=pointer]
                  - button "g13, empty" [ref=e374] [cursor=pointer]
                  - button "h13, empty" [ref=e375] [cursor=pointer]
                  - button "i13, empty" [ref=e376] [cursor=pointer]
                  - button "j13, empty" [ref=e377] [cursor=pointer]
                  - button "3L, k13, triple letter, empty" [ref=e378] [cursor=pointer]:
                    - generic [ref=e379]: 3L
                  - button "l13, empty" [ref=e380] [cursor=pointer]
                  - button "m13, empty" [ref=e381] [cursor=pointer]
                  - button "n13, empty" [ref=e382] [cursor=pointer]
                  - button "o13, empty" [ref=e383] [cursor=pointer]
                  - generic [ref=e384]: "14"
                  - button "a14, empty" [ref=e385] [cursor=pointer]
                  - button "b14, empty" [ref=e386] [cursor=pointer]
                  - button "c14, empty" [ref=e387] [cursor=pointer]
                  - button "2L, d14, double letter, empty" [ref=e388] [cursor=pointer]:
                    - generic [ref=e389]: 2L
                  - button "e14, empty" [ref=e390] [cursor=pointer]
                  - button "f14, empty" [ref=e391] [cursor=pointer]
                  - button "2W, g14, double word, empty" [ref=e392] [cursor=pointer]:
                    - generic [ref=e393]: 2W
                  - button "h14, empty" [ref=e394] [cursor=pointer]
                  - button "2W, i14, double word, empty" [ref=e395] [cursor=pointer]:
                    - generic [ref=e396]: 2W
                  - button "j14, empty" [ref=e397] [cursor=pointer]
                  - button "k14, empty" [ref=e398] [cursor=pointer]
                  - button "2L, l14, double letter, empty" [ref=e399] [cursor=pointer]:
                    - generic [ref=e400]: 2L
                  - button "m14, empty" [ref=e401] [cursor=pointer]
                  - button "n14, empty" [ref=e402] [cursor=pointer]
                  - button "o14, empty" [ref=e403] [cursor=pointer]
                  - generic [ref=e404]: "15"
                  - button "2L, a15, double letter, empty" [ref=e405] [cursor=pointer]:
                    - generic [ref=e406]: 2L
                  - button "b15, empty" [ref=e407] [cursor=pointer]
                  - button "c15, empty" [ref=e408] [cursor=pointer]
                  - button "d15, empty" [ref=e409] [cursor=pointer]
                  - button "3W, e15, triple word, empty" [ref=e410] [cursor=pointer]:
                    - generic [ref=e411]: 3W
                  - button "f15, empty" [ref=e412] [cursor=pointer]
                  - button "g15, empty" [ref=e413] [cursor=pointer]
                  - button "2L, h15, double letter, empty" [ref=e414] [cursor=pointer]:
                    - generic [ref=e415]: 2L
                  - button "i15, empty" [ref=e416] [cursor=pointer]
                  - button "j15, empty" [ref=e417] [cursor=pointer]
                  - button "3W, k15, triple word, empty" [ref=e418] [cursor=pointer]:
                    - generic [ref=e419]: 3W
                  - button "l15, empty" [ref=e420] [cursor=pointer]
                  - button "m15, empty" [ref=e421] [cursor=pointer]
                  - button "n15, empty" [ref=e422] [cursor=pointer]
                  - button "2L, o15, double letter, empty" [ref=e423] [cursor=pointer]:
                    - generic [ref=e424]: 2L
              - generic [ref=e425]:
                - generic [ref=e426]:
                  - img "Whole board overview; outline shows the enlarged area" [ref=e427]
                  - group "View a board region" [ref=e654]:
                    - button "View a1 to e5" [ref=e655] [cursor=pointer]
                    - button "View f1 to j5" [ref=e656] [cursor=pointer]
                    - button "View k1 to o5" [ref=e657] [cursor=pointer]
                    - button "View a6 to e10" [ref=e658] [cursor=pointer]
                    - button "View f6 to j10" [ref=e659] [cursor=pointer]
                    - button "View k6 to o10" [ref=e660] [cursor=pointer]
                    - button "View a11 to e15" [ref=e661] [cursor=pointer]
                    - button "View f11 to j15" [ref=e662] [cursor=pointer]
                    - button "View k11 to o15" [ref=e663] [cursor=pointer]
                - generic [ref=e664]:
                  - generic [ref=e665]:
                    - button "Fit board" [ref=e666] [cursor=pointer]:
                      - paragraph [ref=e669]: Fit board
                    - button "Enlarge board" [pressed] [ref=e670] [cursor=pointer]:
                      - paragraph [ref=e673]: Enlarge board
                  - paragraph [ref=e674]: A 1, h8, committed
                  - 'button "Board map: locate a square" [ref=e675] [cursor=pointer]': Map
          - status [ref=e677]:
            - generic [ref=e678]:
              - generic [ref=e679]: "Amber: avery. Teal: jordan_plays."
              - text: Teal — to play · 86 tiles in the bag
          - generic [ref=e682]:
            - generic [ref=e686]:
              - generic [ref=e687]:
                - img "Amber" [ref=e688]
                - generic "avery" [ref=e691]
              - generic [ref=e694]: 7 tiles
            - generic [ref=e695]:
              - generic [ref=e696]: Score
              - generic [ref=e697]: "10"
        - generic [ref=e700]:
          - group "Game actions" [ref=e701]:
            - button "Offer draw" [ref=e702] [cursor=pointer]:
              - paragraph [ref=e705]: Offer draw
            - button "Resign game" [ref=e706] [cursor=pointer]:
              - paragraph [ref=e709]:
                - text: Resign
                - generic [ref=e710]: game
          - button "History and stats" [ref=e711] [cursor=pointer]:
            - generic [ref=e713]:
              - paragraph [ref=e714]: History and stats
              - img [ref=e717]
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