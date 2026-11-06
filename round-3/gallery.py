from pathlib import Path
import json,subprocess
r=Path(__file__).parent
head=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
stories=json.loads((r/'story-inventory.json').read_text())
lines=['# Round 3 screenshot gallery','',
       f'Automated Storybook captures. Source: `{head}`.',
       'Phone: 390×844; desktop: 1440×900. Both light and dark themes. Before images are round-2 after-images from immutable evidence commit `245f924e5689c5f97f29932a115ad1890859867c`.',
       '', '| Story | Phone light | Phone dark | Desktop light | Desktop dark | Before |', '|---|---|---|---|---|---|']
for s in stories:
    id=s['id'];cells=[]
    for vp in ['phone','desktop']:
        for theme in ['light','dark']:
            f=f'{id}--{vp}--{theme}.png'
            if not (r/'after'/f).exists():raise Exception('Missing final screenshot: '+f)
            cells.append(f'[PNG](after/{f}) / [pair](pairs/{f})')
    before='Captured in round 2' if (r/'before'/f).exists() else '**Absent from round-2 capture**'
    lines.append('| '+s['title']+' / '+s['name']+' | '+' | '.join(cells)+' | '+before+' |')
(r/'GALLERY.md').write_text('\n'.join(lines)+'\n')
print(len(stories)*4,'screenshots indexed')
