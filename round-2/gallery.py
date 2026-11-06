from pathlib import Path
import json
r=Path(__file__).parent
stories=json.loads((r/'story-inventory.json').read_text())
lines=['# Round 2 screenshot gallery','',
       'Automated Storybook captures. Source: `7580af9100ad5487a06f0a3334aa09be0c7ce5dc`.',
       'Phone: 390×844; desktop: 1440×900. Both light and dark themes. Before images are round-1 after-images from immutable evidence commit `40b34146d50454f12bf290d19611e6884a4c65de`.',
       '', '| Story | Phone light | Phone dark | Desktop light | Desktop dark | Before |', '|---|---|---|---|---|---|']
for s in stories:
    id=s['id'];cells=[]
    for vp in ['phone','desktop']:
        for theme in ['light','dark']:
            f=f'{id}--{vp}--{theme}.png'
            if not (r/'after'/f).exists():raise Exception('Missing final screenshot: '+f)
            cells.append(f'[PNG](after/{f}) / [pair](pairs/{f})')
    before='Captured in round 1' if (r/'before'/f).exists() else '**Absent from round-1 capture**'
    lines.append('| '+s['title']+' / '+s['name']+' | '+' | '.join(cells)+' | '+before+' |')
(r/'GALLERY.md').write_text('\n'.join(lines)+'\n')
print(len(stories)*4,'screenshots indexed')
