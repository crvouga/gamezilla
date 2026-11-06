from pathlib import Path
import json,sys

r=Path(__file__).parent
sha=sys.argv[1]
m=json.loads((r/'manifest.json').read_text())
journeys=json.loads((r/'journeys/mapping.json').read_text())
base=f'https://raw.githubusercontent.com/crvouga/gamezilla/{sha}/round-2'
repo=f'https://github.com/crvouga/gamezilla/blob/{sha}/round-2'
for part,entries in enumerate([journeys[:7],journeys[7:]],1):
    lines=[f'<!-- overhaul-loop:media-round-2-part-{part} -->',
      f'## Board round 2 — screenshots and videos, part {part}',
      f'Candidate `{m["candidateSha"]}` · evidence `{m["evidence_code"]}`.',
      f'[Manifest]({repo}/manifest.json) · [600-image gallery]({repo}/GALLERY.md) · [Before/after pairs]({repo}/pairs) · [Exhaustive story inventory]({repo}/story-inventory.json) · [Journey limits]({repo}/journeys/mapping.json)',
      m['publicStatus'],
      'Automated Storybook only. No manual QA, ratings or merge. Videos use native Storybook assertion checkpoints with recorder-only pacing. These are pinned WebM links, not embedded video players. Before images are immutable round-1 captures; absent-before states are explicit. Test viewports: 390×844 and 1440×844; gallery viewports: 390×844 and 1440×900.',
      '']
    for j in entries:
        story=j['representativeInteractionStories'][0]
        lines.extend([f'<details><summary>{j["journeyId"]}: {j["component"]} — {j["goal"]}</summary>','',
                      '| View | Before | After |','|---|---|---|'])
        for vp in ['phone','desktop']:
            for theme in ['light','dark']:
                f=f'{story}--{vp}--{theme}.png'
                before=f'![Before]({base}/before/{f})' if (r/'before'/f).exists() else '**Absent in round-1 capture**'
                lines.append(f'| {vp} · {theme} | {before} | ![After]({base}/after/{f}) |')
        lines.extend(['',f'**Checks:** {j["status"]}',f'**Limits:** {j["remainingJourneyGap"]}',''])
        for video in j['representativeInteractionStories']:
            lines.extend([f'**Automated journey:** `{video}`',
               f'[Phone WebM]({base}/journeys/recordings/videos/{video}--phone--light.webm) · [Desktop WebM]({base}/journeys/recordings/videos/{video}--desktop--light.webm)',
               f'[![Recorded journey thumbnail]({base}/journeys/recordings/{video}--phone--light.png)]({base}/journeys/recordings/videos/{video}--phone--light.webm)',''])
        lines.extend(['</details>',''])
    (r/f'media-comment-{part}.md').write_text('\n'.join(lines)+'\n')
print('Wrote two pinned media comments')
