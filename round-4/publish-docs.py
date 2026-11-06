from pathlib import Path
import json,sys

r=Path(__file__).parent
sha=sys.argv[1]
m=json.loads((r/'manifest.json').read_text())
journeys=json.loads((r/'journeys/mapping.json').read_text())
base=f'https://raw.githubusercontent.com/crvouga/gamezilla/{sha}/round-4'
repo=f'https://github.com/crvouga/gamezilla/blob/{sha}/round-4'
for part,entries in enumerate([journeys[:7],journeys[7:]],1):
    lines=[f'<!-- overhaul-loop:media-round-4-part-{part} -->',
      f'## Board round 4 — screenshots and videos, part {part}',
      f'Candidate `{m["candidateSha"]}` · evidence `{m["evidence_code"]}`.',
      f'[Manifest]({repo}/manifest.json) · [Screenshot gallery]({repo}/GALLERY.md) · [Before/after pairs]({repo}/pairs) · [Exhaustive story inventory]({repo}/story-inventory.json) · [Journey limits]({repo}/journeys/mapping.json)',
      m['publicStatus'],
      f'[Integration handoff and exact outcomes]({repo}/HANDOFF.md). Hosted `verify:end` succeeded on this candidate. Full local `bun verify` failed at the existing `/more/troubleshooting` chart ownership gate; coverage reports 270 violations. Canonical Ubuntu authoring succeeded, same-head comparison was still running at the saved snapshot, and zero references are accepted.',
      'Automated Storybook only. No manual QA, ratings or merge. Videos use native Storybook assertion checkpoints with recorder-only pacing. These are pinned WebM links, not embedded video players. Before images are immutable round-3 captures; absent-before states are explicit. Test viewports: 390×844 and 1440×844; gallery viewports: 390×844 and 1440×900.',
      '']
    for j in entries:
        story=j['representativeInteractionStories'][0]
        lines.extend([f'<details><summary>{j["journeyId"]}: {j["component"]} — {j["goal"]}</summary>','',
                      '| View | Before | After |','|---|---|---|'])
        for vp in ['phone','desktop']:
            for theme in ['light','dark']:
                f=f'{story}--{vp}--{theme}.png'
                before=f'![Before]({base}/before/{f})' if (r/'before'/f).exists() else '**Absent in round-3 capture**'
                lines.append(f'| {vp} · {theme} | {before} | ![After]({base}/after/{f}) |')
        lines.extend(['',f'**Checks:** {j["status"]}',f'**Limits:** {j["remainingJourneyGap"]}',''])
        for video in j['representativeInteractionStories']:
            lines.extend([f'**Automated journey:** `{video}`',
               f'[Phone WebM]({base}/journeys/recordings/videos/{video}--phone--light.webm) · [Desktop WebM]({base}/journeys/recordings/videos/{video}--desktop--light.webm)',
               f'[![Recorded journey thumbnail]({base}/journeys/recordings/{video}--phone--light.png)]({base}/journeys/recordings/videos/{video}--phone--light.webm)',''])
        lines.extend(['</details>',''])
    (r/f'media-comment-{part}.md').write_text('\n'.join(lines)+'\n')
print('Wrote two pinned media comments')
