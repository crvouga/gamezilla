# Sound style guide

## Emotional tone

Modern, clean, satisfying, lightweight, unobtrusive — confident but never shouty.

## Sonic palette

- **Backbone:** Kenney Interface Sounds — soft digital UI clicks, toggles, open/close
- **Accents:** Kenney Digital Audio — connection/sync sci-fi tones
- **Foley:** Kenney Impact / RPG / Casino — move, capture, coins, unlock
- **Stingers:** Kenney Music Jingles (Pizzicato only) — achievement, victory, defeat, milestones

## Frequency balance

| Layer    | Range                                |
| -------- | ------------------------------------ |
| UI taps  | 800 Hz – 4 kHz emphasis              |
| Stingers | Up to 6 kHz sparkle                  |
| Mobile   | Avoid heavy sub-bass on routine taps |

## Loudness targets

| Category                 | Target              |
| ------------------------ | ------------------- |
| UI / navigation / forms  | −18 LUFS integrated |
| Notifications / stingers | −16 LUFS integrated |
| Peak limit (all)         | −1 dBTP             |

## Duration caps

| Category      | Max duration |
| ------------- | ------------ |
| UI            | 150 ms       |
| Feedback      | 300 ms       |
| Notifications | 600 ms       |
| Stingers      | 1500 ms      |

No looping sounds.

## Attack / release

- Fast attack (≤ 10 ms) on UI taps
- Soft exponential release
- No long reverb tails on navigation sounds

## Consistency rules

1. One primary click, one primary toggle, one success/error pair app-wide
2. Variants only where UX weight differs (primary vs destructive)
3. Reject timbral outliers during curation — do not force-fill every taxonomy slot

## Sounds to avoid

- Cartoon boings and 8-bit bleeps as default UI
- Harsh clipping or audible noise floor
- Casino slot-machine loops
- Literal voice lines for routine UI
- Overly cinematic impacts for taps

## Accessibility

- Global mute preference (`ui.prefs/sounds-muted`)
- Master volume scalar (`ui.prefs/sounds-master-volume`)
- Never rely on sound alone — pair with visual mutation states
- Suppress non-critical SFX when `prefers-reduced-motion` is enabled

## Primary source packs

| Pack                      | License | Role                                    |
| ------------------------- | ------- | --------------------------------------- |
| Interface Sounds          | CC0     | Navigation, forms, feedback             |
| UI Audio                  | CC0     | Alternate clicks/switches               |
| Music Jingles (Pizzicato) | CC0     | Achievement / victory / defeat stingers |
| Digital Audio             | CC0     | Sync, connection tones                  |
| Impact Sounds             | CC0     | Move, capture, combo                    |
| RPG Audio                 | CC0     | Unlock, inventory                       |
| Casino Audio              | CC0     | Commerce coin/chip foley                |
| Sci-Fi Sounds             | CC0     | Multiplayer digital accents             |
